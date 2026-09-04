/**
 * 备忘列表状态与保存逻辑。
 * 载入时读取全部备忘文件并在内存按 updatedAt 倒序；输入防抖 800ms 自动保存，
 * 每条备忘独立的防抖定时器与串行写链（模式同 src/stores/day-editor.ts）；
 * 新建备忘首次输入才落盘，失焦仍为空则静默丢弃；已落盘备忘被清空后失焦即删除；
 * 保存失败保留脏数据并标记失败，下次输入或失焦 flush 时重试。
 */

import { get, writable } from 'svelte/store'
import type { ExtensionContext } from '../../../src/core/host'
import { compareMemos, createMemo, memoPath, parseMemo, type Memo } from './memos'

/** 自动保存的防抖时长（与日记编辑器一致）。 */
export const SAVE_DEBOUNCE_MS = 800

/** 备忘列表；null 表示尚未载入。 */
export const memos = writable<Memo[] | null>(null)

/** 保存失败的备忘 id 集合（视图据此展示失败标记，恢复成功后移除）。 */
export const saveErrors = writable<ReadonlySet<string>>(new Set())

/** 单条备忘的运行时编辑状态（不入 store，避免无关重渲染）。 */
type MemoRuntime = {
  timer: ReturnType<typeof setTimeout> | null
  dirty: boolean
  /** 最近一次成功落盘的正文，用于判定脏状态。 */
  savedText: string
  /** 串行写链，避免并发写同一文件乱序。 */
  chain: Promise<void>
}

const runtime = new Map<string, MemoRuntime>()

/** 取备忘的运行时状态，不存在则初始化。 */
function runtimeOf(id: string): MemoRuntime {
  let rt = runtime.get(id)
  if (!rt) {
    rt = { timer: null, dirty: false, savedText: '', chain: Promise.resolve() }
    runtime.set(id, rt)
  }
  return rt
}

/** 标记/清除某条备忘的保存失败状态。 */
function setError(id: string, failed: boolean): void {
  saveErrors.update((prev) => {
    const next = new Set(prev)
    if (failed) next.add(id)
    else next.delete(id)
    return next
  })
}

/** 载入全部备忘：memos/ 不存在按空列表；损坏文件跳过并记日志。 */
export async function loadMemos(ctx: ExtensionContext): Promise<void> {
  const listing = await ctx.fs.listDir(['memos'])
  if (listing === null) {
    memos.set([])
    return
  }
  const result: Memo[] = []
  for (const file of listing.files) {
    if (!file.endsWith('.json')) continue
    const id = file.slice(0, -'.json'.length)
    try {
      const memo = parseMemo(await ctx.fs.readJson(memoPath(id)))
      if (memo === null) ctx.log.warn('跳过损坏的备忘文件', file)
      else result.push(memo)
    } catch (err) {
      ctx.log.warn('备忘文件读取失败', file, err)
    }
  }
  result.sort(compareMemos)
  memos.set(result)
}

/** 新建空备忘并置顶（首次输入才落盘）；返回 id 供视图聚焦。 */
export function addMemo(): string {
  const id = crypto.randomUUID()
  const memo = createMemo(id, Date.now())
  runtimeOf(id)
  memos.update((list) => [memo, ...(list ?? [])])
  return id
}

/** 执行一次保存：写 memos/<id>.json 并按新 updatedAt 重排列表；无脏数据直接返回。 */
async function save(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtime.get(id)
  const list = get(memos)
  const memo = list?.find((m) => m.id === id)
  if (!rt || !rt.dirty || !memo) return
  const snapshot: Memo = { ...memo, updatedAt: Date.now() }
  try {
    await ctx.fs.writeJson(memoPath(id), snapshot)
    rt.savedText = snapshot.text
    // 保存期间可能有新输入，重新判定脏状态
    const current = get(memos)?.find((m) => m.id === id)
    rt.dirty = current !== undefined && current.text !== rt.savedText
    if (current !== undefined) {
      memos.set(
        [...get(memos)!.map((m) => (m.id === id ? { ...snapshot, text: current.text } : m))].sort(
          compareMemos,
        ),
      )
    }
    setError(id, false)
    if (rt.dirty) scheduleSave(ctx, id)
  } catch (err) {
    // 保留脏数据：下次输入或失焦 flush 时重试
    ctx.log.error('备忘保存失败', id, err)
    rt.dirty = true
    setError(id, true)
  }
}

/** 把一次保存挂到该备忘的写链尾。 */
function enqueueSave(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtimeOf(id)
  rt.chain = rt.chain.then(() => save(ctx, id))
  return rt.chain
}

/** 调度某条备忘的防抖保存。 */
function scheduleSave(ctx: ExtensionContext, id: string): void {
  const rt = runtimeOf(id)
  if (rt.timer !== null) clearTimeout(rt.timer)
  rt.timer = setTimeout(() => {
    rt.timer = null
    void enqueueSave(ctx, id)
  }, SAVE_DEBOUNCE_MS)
}

/** 输入变化：更新内存中的正文，按与已保存内容的差异调度防抖保存。 */
export function updateMemoText(ctx: ExtensionContext, id: string, text: string): void {
  const rt = runtimeOf(id)
  memos.update((list) => (list ?? []).map((m) => (m.id === id ? { ...m, text } : m)))
  rt.dirty = text !== rt.savedText
  if (rt.dirty) scheduleSave(ctx, id)
  else if (rt.timer !== null) {
    clearTimeout(rt.timer)
    rt.timer = null
  }
}

/** 立即落盘某条备忘的未保存内容。 */
export function flushMemo(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtimeOf(id)
  if (rt.timer !== null) {
    clearTimeout(rt.timer)
    rt.timer = null
  }
  return enqueueSave(ctx, id)
}

/** 删除备忘：取消防抖后直接删文件（不存在不报错）并从列表移除。 */
export async function removeMemo(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtime.get(id)
  if (rt?.timer != null) clearTimeout(rt.timer)
  runtime.delete(id)
  setError(id, false)
  memos.update((list) => (list ?? []).filter((m) => m.id !== id))
  await ctx.fs.remove(memoPath(id))
}

/**
 * 失焦处理：先 flush 未保存内容；正文为空的备忘直接删除
 * （空备忘无内容可失，无论是否落盘过都不需确认）。
 */
export async function blurMemo(ctx: ExtensionContext, id: string): Promise<void> {
  await flushMemo(ctx, id)
  const memo = get(memos)?.find((m) => m.id === id)
  if (memo !== undefined && memo.text.trim() === '') await removeMemo(ctx, id)
}

/** 视图卸载前 flush 全部未保存内容。 */
export async function flushAll(ctx: ExtensionContext): Promise<void> {
  const list = get(memos) ?? []
  await Promise.all(list.map((m) => flushMemo(ctx, m.id)))
}
