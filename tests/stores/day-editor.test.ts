import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'
import { createEmptyDayDoc, FLAG_TEXT } from '../../src/core/domain'

/** 内存假后端：替代真实存储 Worker（由 vi.mock 注入）。 */
const backend = vi.hoisted(() => {
  const docs = new Map<number, unknown>()
  return {
    docs,
    readDayDoc: vi.fn(async (day: number) => docs.get(day) ?? null),
    writeDayDoc: vi.fn(async (day: number, doc: unknown) => {
      docs.set(day, doc)
    }),
    writeIndex: vi.fn(async () => {}),
  }
})

vi.mock('../../src/core/storage', () => ({
  createStorageBackend: () => backend,
}))

/** 重置模块后载入被测 store，并把日索引置为 total 天全空。 */
async function setup(total = 10) {
  const di = await import('../../src/stores/day-index')
  di.dayIndex.set(new Uint8Array(total))
  const de = await import('../../src/stores/day-editor')
  return { ...de, dayIndexStore: di.dayIndex }
}

describe('day-editor store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    backend.docs.clear()
    backend.readDayDoc.mockClear()
    backend.writeDayDoc.mockClear()
    backend.writeIndex.mockClear()
  })

  it('载入既有文档', async () => {
    backend.docs.set(3, { text: 'hello', media: [], updatedAt: 1, version: 1 })
    const de = await setup()
    await de.loadDay(3)
    expect(get(de.editorDoc)?.text).toBe('hello')
    expect(get(de.saveState)).toBe('idle')
  })

  it('文档不存在时给空文档', async () => {
    const de = await setup()
    await de.loadDay(5)
    expect(get(de.editorDoc)).toEqual(createEmptyDayDoc())
  })

  it('越界深链不载入（由 closeDay 关闭，测试环境为空操作）', async () => {
    const de = await setup()
    await de.loadDay(10)
    expect(get(de.editorDoc)).toBeNull()
    expect(backend.readDayDoc).not.toHaveBeenCalled()
  })

  it('输入后防抖 800ms 自动保存并同步标志位', async () => {
    const de = await setup()
    await de.loadDay(2)
    de.updateText('今天天气不错')
    expect(get(de.saveState)).toBe('dirty')
    expect(backend.writeDayDoc).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(800)
    await de.flushSave() // 等保存链落定
    expect(backend.writeDayDoc).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ text: '今天天气不错' }),
    )
    expect(get(de.dayIndexStore)[2]).toBe(FLAG_TEXT)
    expect(backend.writeIndex).toHaveBeenCalledTimes(1)
    expect(get(de.saveState)).toBe('saved')
  })

  it('连续编辑时文档多次保存，但标志位只在跳变时写一次', async () => {
    const de = await setup()
    await de.loadDay(2)
    de.updateText('a')
    await vi.advanceTimersByTimeAsync(800)
    await de.flushSave()
    de.updateText('ab')
    await vi.advanceTimersByTimeAsync(800)
    await de.flushSave()
    expect(backend.writeDayDoc).toHaveBeenCalledTimes(2)
    expect(backend.writeIndex).toHaveBeenCalledTimes(1)
  })

  it('清空文本时写空文档并清标志位', async () => {
    backend.docs.set(4, { text: 'x', media: [], updatedAt: 1, version: 1 })
    const de = await setup()
    de.dayIndexStore.set(new Uint8Array(10).fill(0).map((_, i) => (i === 4 ? FLAG_TEXT : 0)))
    await de.loadDay(4)
    de.updateText('')
    await vi.advanceTimersByTimeAsync(800)
    await de.flushSave()
    expect(backend.writeDayDoc).toHaveBeenCalledWith(4, expect.objectContaining({ text: '' }))
    expect(get(de.dayIndexStore)[4]).toBe(0)
  })

  it('关闭时 flush：未到防抖时间也立即保存', async () => {
    const de = await setup()
    await de.loadDay(1)
    de.updateText('等不到防抖')
    await de.closeEditor()
    expect(backend.writeDayDoc).toHaveBeenCalledTimes(1)
    expect(get(de.editorDoc)).toBeNull()
    expect(get(de.saveState)).toBe('idle')
  })

  it('保存失败进入 error 态并保留脏数据，重试可成功', async () => {
    backend.writeDayDoc.mockRejectedValueOnce(new Error('写盘失败'))
    const de = await setup()
    await de.loadDay(1)
    de.updateText('x')
    await de.flushSave()
    expect(get(de.saveState)).toBe('error')
    await de.flushSave() // 重试
    expect(get(de.saveState)).toBe('saved')
    expect(backend.writeDayDoc).toHaveBeenCalledTimes(2)
  })
})
