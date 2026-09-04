/**
 * 待办列表状态与保存逻辑。
 * 模式同 extensions/memo/src/store.ts：载入时读取全部待办文件；正文输入防抖 800ms 自动保存，
 * 离散操作（勾选完成、打卡、改调度）立即落盘；每条待办独立的防抖定时器与串行写链。
 * 新建待办首次产生内容才落盘；失焦时「正文空 + 无日期 + 无打卡」的完全空待办静默丢弃；
 * 保存失败保留脏数据并标记失败，下次输入或失焦 flush 时重试。
 * 列表在 store 内保持扁平（按 createdAt 稳定排序），分组与组内排序由视图经
 * groupOf / compareInGroup 实时派生。
 */

import { get, writable } from 'svelte/store'
import { localISODate } from '../../../src/core/domain/life'
import type { ExtensionContext } from '../../../src/core/host'
import {
  checkIn,
  createTodo,
  parseTodo,
  setDone,
  todoPath,
  withSchedule,
  type Todo,
  type TodoSchedule,
} from './todos'

/** 自动保存的防抖时长（与日记编辑器一致）。 */
export const SAVE_DEBOUNCE_MS = 800

/** 待办列表（扁平）；null 表示尚未载入。 */
export const todos = writable<Todo[] | null>(null)

/** 保存失败的待办 id 集合（视图据此展示失败标记，恢复成功后移除）。 */
export const saveErrors = writable<ReadonlySet<string>>(new Set())

/** 单条待办的运行时编辑状态（不入 store，避免无关重渲染）。 */
type TodoRuntime = {
  timer: ReturnType<typeof setTimeout> | null
  dirty: boolean
  /** 最近一次成功落盘的文档（updatedAt 为落盘时的取值），用于判定脏状态。 */
  saved: Todo
  /** 串行写链，避免并发写同一文件乱序。 */
  chain: Promise<void>
}

const runtime = new Map<string, TodoRuntime>()

/** 取待办的运行时状态，不存在则以当前文档为已存基线初始化。 */
function runtimeOf(id: string): TodoRuntime {
  let rt = runtime.get(id)
  if (!rt) {
    const current = get(todos)?.find((t) => t.id === id)
    rt = {
      timer: null,
      dirty: false,
      saved: current ?? createTodo(id, Date.now()),
      chain: Promise.resolve(),
    }
    runtime.set(id, rt)
  }
  return rt
}

/** 调度相等（字段逐一比较，不依赖序列化键序）。 */
function scheduleEqual(a: TodoSchedule, b: TodoSchedule): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'none') return true
  if (a.kind === 'deadline' && b.kind === 'deadline') return a.due === b.due
  if (a.kind === 'range' && b.kind === 'range') {
    return a.start === b.start && a.end === b.end && a.requiredDays === b.requiredDays
  }
  return false
}

/** 内容相等判定：比较除 updatedAt 外的全部可变字段。 */
function contentEqual(a: Todo, b: Todo): boolean {
  return (
    a.text === b.text &&
    a.done === b.done &&
    scheduleEqual(a.schedule, b.schedule) &&
    a.checkIns.length === b.checkIns.length &&
    a.checkIns.every((d, i) => d === b.checkIns[i])
  )
}

/** 标记/清除某条待办的保存失败状态。 */
function setError(id: string, failed: boolean): void {
  saveErrors.update((prev) => {
    const next = new Set(prev)
    if (failed) next.add(id)
    else next.delete(id)
    return next
  })
}

/** 就地更新列表中的某条待办。 */
function patch(id: string, next: Todo): void {
  todos.update((list) => (list ?? []).map((t) => (t.id === id ? next : t)))
}

/** 载入全部待办：todos/ 不存在按空列表；损坏文件跳过并记日志；按 createdAt 稳定排序。已载入则跳过（幂等）。 */
export async function loadTodos(ctx: ExtensionContext): Promise<void> {
  if (get(todos) !== null) return
  const listing = await ctx.fs.listDir(['todos'])
  if (listing === null) {
    todos.set([])
    return
  }
  const result: Todo[] = []
  for (const file of listing.files) {
    if (!file.endsWith('.json')) continue
    const id = file.slice(0, -'.json'.length)
    try {
      const todo = parseTodo(await ctx.fs.readJson(todoPath(id)))
      if (todo === null) ctx.log.warn('跳过损坏的待办文件', file)
      else result.push(todo)
    } catch (err) {
      ctx.log.warn('待办文件读取失败', file, err)
    }
  }
  result.sort((a, b) =>
    a.createdAt !== b.createdAt
      ? a.createdAt - b.createdAt
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0,
  )
  todos.set(result)
}

/** 新建空待办并入列（首次产生内容才落盘）；返回 id 供视图聚焦。 */
export function addTodo(): string {
  const id = crypto.randomUUID()
  const todo = createTodo(id, Date.now())
  runtimeOf(id)
  todos.update((list) => [todo, ...(list ?? [])])
  return id
}

/** 执行一次保存：写 todos/<id>.json；无脏数据直接返回。 */
async function save(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtime.get(id)
  const todo = get(todos)?.find((t) => t.id === id)
  if (!rt || !rt.dirty || !todo) return
  const snapshot: Todo = { ...todo, updatedAt: Date.now() }
  try {
    await ctx.fs.writeJson(todoPath(id), snapshot)
    rt.saved = snapshot
    // 保存期间可能有新编辑，重新判定脏状态
    const current = get(todos)?.find((t) => t.id === id)
    rt.dirty = current !== undefined && !contentEqual(current, rt.saved)
    if (current !== undefined) {
      patch(id, { ...current, updatedAt: snapshot.updatedAt })
    }
    setError(id, false)
    if (rt.dirty) scheduleSave(ctx, id)
  } catch (err) {
    // 保留脏数据：下次编辑或失焦 flush 时重试
    ctx.log.error('待办保存失败', id, err)
    rt.dirty = true
    setError(id, true)
  }
}

/** 把一次保存挂到该待办的写链尾。 */
function enqueueSave(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtimeOf(id)
  rt.chain = rt.chain.then(() => save(ctx, id))
  return rt.chain
}

/** 调度某条待办的防抖保存。 */
function scheduleSave(ctx: ExtensionContext, id: string): void {
  const rt = runtimeOf(id)
  if (rt.timer !== null) clearTimeout(rt.timer)
  rt.timer = setTimeout(() => {
    rt.timer = null
    void enqueueSave(ctx, id)
  }, SAVE_DEBOUNCE_MS)
}

/** 编辑后更新脏状态；离散操作（immediate=true）跳过防抖立即落盘。 */
function mutate(ctx: ExtensionContext, id: string, next: Todo, immediate: boolean): Promise<void> {
  const rt = runtimeOf(id)
  patch(id, next)
  rt.dirty = !contentEqual(next, rt.saved)
  if (!rt.dirty) {
    if (rt.timer !== null) {
      clearTimeout(rt.timer)
      rt.timer = null
    }
    return Promise.resolve()
  }
  if (immediate) {
    if (rt.timer !== null) {
      clearTimeout(rt.timer)
      rt.timer = null
    }
    return enqueueSave(ctx, id)
  }
  scheduleSave(ctx, id)
  return rt.chain
}

/** 正文输入：更新内存并按差异调度防抖保存。 */
export function updateTodoText(ctx: ExtensionContext, id: string, text: string): void {
  const current = get(todos)?.find((t) => t.id === id)
  if (!current) return
  // 与 memo 一致：内存中的 updatedAt 仅在落盘时前进
  void mutate(ctx, id, { ...current, text }, false)
}

/** 勾选/取消完成：立即落盘。 */
export function toggleDone(ctx: ExtensionContext, id: string): Promise<void> {
  const current = get(todos)?.find((t) => t.id === id)
  if (!current) return Promise.resolve()
  return mutate(ctx, id, setDone(current, !current.done, Date.now()), true)
}

/** 给区间型待办打今天的卡（达标自动完成）：立即落盘。 */
export function checkInToday(ctx: ExtensionContext, id: string): Promise<void> {
  const current = get(todos)?.find((t) => t.id === id)
  if (!current) return Promise.resolve()
  const now = new Date()
  return mutate(ctx, id, checkIn(current, localISODate(now), now.getTime()), true)
}

/** 更换调度：立即落盘。 */
export function changeSchedule(
  ctx: ExtensionContext,
  id: string,
  schedule: TodoSchedule,
): Promise<void> {
  const current = get(todos)?.find((t) => t.id === id)
  if (!current) return Promise.resolve()
  return mutate(ctx, id, withSchedule(current, schedule, Date.now()), true)
}

/** 立即落盘某条待办的未保存内容。 */
export function flushTodo(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtimeOf(id)
  if (rt.timer !== null) {
    clearTimeout(rt.timer)
    rt.timer = null
  }
  return enqueueSave(ctx, id)
}

/** 删除待办：取消防抖后直接删文件（不存在不报错）并从列表移除。 */
export async function removeTodo(ctx: ExtensionContext, id: string): Promise<void> {
  const rt = runtime.get(id)
  if (rt?.timer != null) clearTimeout(rt.timer)
  runtime.delete(id)
  setError(id, false)
  todos.update((list) => (list ?? []).filter((t) => t.id !== id))
  await ctx.fs.remove(todoPath(id))
}

/** 完全为空（无正文、无日期、无打卡）的待办不含任何信息。 */
function isEmpty(todo: Todo): boolean {
  return todo.text.trim() === '' && todo.schedule.kind === 'none' && todo.checkIns.length === 0
}

/** 失焦处理：先 flush 未保存内容；完全为空的待办静默丢弃（无需确认）。 */
export async function blurTodo(ctx: ExtensionContext, id: string): Promise<void> {
  await flushTodo(ctx, id)
  const todo = get(todos)?.find((t) => t.id === id)
  if (todo !== undefined && isEmpty(todo)) await removeTodo(ctx, id)
}

/** 视图卸载前 flush 全部未保存内容。 */
export async function flushAll(ctx: ExtensionContext): Promise<void> {
  const list = get(todos) ?? []
  await Promise.all(list.map((t) => flushTodo(ctx, t.id)))
}
