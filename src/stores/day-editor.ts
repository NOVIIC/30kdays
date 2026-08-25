/**
 * 日记编辑器状态与保存逻辑。
 * 打开/关闭由路由深链 ?d=<index>（stores/router.openDay）驱动，组件见 ui/DayEditor.svelte；
 * 输入后防抖 800ms 自动保存（写 days/<n>.json），关闭或切换日期前 flush；
 * 保存成功后经 setDayFlags 同步 index.bin 标志位（变化才写盘）。
 * 内容清空时保留空文档、仅清标志位（决策见 crt.md）。
 */

import { get, writable } from 'svelte/store'
import { createEmptyDayDoc, flagsOfDoc, type DayDoc } from '../core/domain'
import { dayIndex, setDayFlags } from './day-index'
import { closeDay } from './router'
import { getBackend } from './storage'

/** 自动保存的防抖时长（毫秒）。 */
export const SAVE_DEBOUNCE_MS = 800

/** 保存状态：idle 初始或无改动 / dirty 有未保存内容 / saving 写盘中 / saved 已保存 / error 保存失败。 */
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** 当前编辑的文档；未打开或载入中为 null。 */
export const editorDoc = writable<DayDoc | null>(null)

/** 当前的保存状态。 */
export const saveState = writable<SaveState>('idle')

let currentDay: number | null = null
let savedText = ''
let dirty = false
let loadToken = 0
let timer: ReturnType<typeof setTimeout> | null = null
let saveChain: Promise<void> = Promise.resolve()

/** 取消防抖定时器。 */
function cancelTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

/** 把一次保存挂到保存链尾，串行执行以避免并发写盘乱序。 */
function enqueueSave(): Promise<void> {
  saveChain = saveChain.then(save)
  return saveChain
}

/** 调度防抖保存。 */
function scheduleSave(): void {
  cancelTimer()
  timer = setTimeout(() => {
    timer = null
    void enqueueSave()
  }, SAVE_DEBOUNCE_MS)
}

/** 执行一次保存：写日记文档并同步 index.bin 标志位；无脏数据时直接返回。 */
async function save(): Promise<void> {
  const doc = get(editorDoc)
  const day = currentDay
  if (!dirty || doc === null || day === null) return
  saveState.set('saving')
  const snapshot: DayDoc = { ...doc, updatedAt: Date.now() }
  try {
    const backend = getBackend()
    await backend.writeDayDoc(day, snapshot)
    await setDayFlags(backend, day, flagsOfDoc(snapshot))
    savedText = snapshot.text
    // 保存期间可能有新输入，重新判定脏状态
    dirty = get(editorDoc)?.text !== savedText
    saveState.set(dirty ? 'dirty' : 'saved')
    if (dirty) scheduleSave()
  } catch (err) {
    // 保持脏数据：下次输入或关闭 flush 时重试
    console.error('日记保存失败', err)
    dirty = true
    saveState.set('error')
  }
}

/**
 * 打开某天：flush 上一天的未保存内容后载入文档（不存在给空文档）。
 * 索引越界（非法深链）时直接关闭深链。
 */
export async function loadDay(day: number): Promise<void> {
  const total = get(dayIndex).length
  if (day < 0 || day >= total) {
    closeDay()
    return
  }
  await flushSave()
  const token = ++loadToken
  cancelTimer()
  dirty = false
  currentDay = day
  editorDoc.set(null)
  saveState.set('idle')
  const doc = (await getBackend().readDayDoc(day)) ?? createEmptyDayDoc()
  if (token !== loadToken) return // 载入期间已切换或关闭
  savedText = doc.text
  editorDoc.set(doc)
}

/** 输入变化：更新内存文档，按与已保存内容的差异调度防抖保存。 */
export function updateText(text: string): void {
  const doc = get(editorDoc)
  if (doc === null || currentDay === null || text === doc.text) return
  editorDoc.set({ ...doc, text })
  dirty = text !== savedText
  saveState.set(dirty ? 'dirty' : 'idle')
  if (dirty) scheduleSave()
  else cancelTimer()
}

/** 立即保存未落盘的内容（关闭 / 切换日期前调用）。 */
export function flushSave(): Promise<void> {
  cancelTimer()
  return enqueueSave()
}

/** 关闭编辑器：flush 未保存内容后清空编辑态（深链关闭由组件经 closeDay 处理）。 */
export async function closeEditor(): Promise<void> {
  await flushSave()
  loadToken++
  cancelTimer()
  currentDay = null
  savedText = ''
  dirty = false
  editorDoc.set(null)
  saveState.set('idle')
}
