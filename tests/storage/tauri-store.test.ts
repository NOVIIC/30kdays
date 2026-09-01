import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLifeConfig } from '../../src/core/domain/life'
import { createEmptyDayDoc } from '../../src/core/domain/day-doc'

/** invoke mock：默认抛错，各用例按命令名设定期望行为。 */
const invokeMock = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}))

import { createTauriStore } from '../../src/core/storage/tauri-store'

beforeEach(() => invokeMock.mockReset())

describe('config / dayDoc（JSON 字符串直通）', () => {
  it('readConfig 未初始化（null）返回 null', async () => {
    invokeMock.mockResolvedValue(null)
    const store = createTauriStore()
    expect(await store.readConfig()).toBeNull()
    expect(invokeMock).toHaveBeenCalledWith('storage_read_config', undefined)
  })

  it('writeConfig 序列化为字符串，readConfig 解析回对象', async () => {
    const config = createLifeConfig('2000-01-01', 80)
    const store = createTauriStore()
    await store.writeConfig(config)
    expect(invokeMock).toHaveBeenCalledWith('storage_write_config', {
      json: JSON.stringify(config),
    })
    invokeMock.mockResolvedValue(JSON.stringify(config))
    expect(await store.readConfig()).toEqual(config)
  })

  it('readDayDoc 带 day 参数；writeDayDoc 序列化直通', async () => {
    const doc = { ...createEmptyDayDoc(), text: '今天', updatedAt: 1 }
    const store = createTauriStore()
    invokeMock.mockResolvedValue(null)
    expect(await store.readDayDoc(42)).toBeNull()
    expect(invokeMock).toHaveBeenCalledWith('storage_read_day_doc', { day: 42 })
    await store.writeDayDoc(42, doc)
    expect(invokeMock).toHaveBeenCalledWith('storage_write_day_doc', {
      day: 42,
      json: JSON.stringify(doc),
    })
    invokeMock.mockResolvedValue(JSON.stringify(doc))
    expect(await store.readDayDoc(42)).toEqual(doc)
  })
})

describe('字节读取（空字节流即不存在）', () => {
  it('readIndex 空字节流映射为 null，非空返回 Uint8Array', async () => {
    const store = createTauriStore()
    invokeMock.mockResolvedValue(new ArrayBuffer(0))
    expect(await store.readIndex()).toBeNull()
    const bytes = new Uint8Array([9, 8, 7])
    invokeMock.mockResolvedValue(bytes.buffer)
    expect(await store.readIndex()).toEqual(bytes)
  })

  it('getMedia 空字节流映射为 null，非空包装为 Blob', async () => {
    const store = createTauriStore()
    invokeMock.mockResolvedValue(new ArrayBuffer(0))
    expect(await store.getMedia(7, 'a', 'full')).toBeNull()
    invokeMock.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    const blob = await store.getMedia(7, 'a', 'thumb')
    expect(invokeMock).toHaveBeenCalledWith('storage_get_media', {
      day: 7,
      id: 'a',
      kind: 'thumb',
    })
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('readFile 透传段数组路径', async () => {
    const store = createTauriStore()
    invokeMock.mockResolvedValue(new ArrayBuffer(0))
    expect(await store.readFile(['ext', 'memo', 'memos.json'])).toBeNull()
    expect(invokeMock).toHaveBeenCalledWith('storage_read_file', {
      path: ['ext', 'memo', 'memos.json'],
    })
  })
})

describe('字节写入', () => {
  it('writeIndex 以原始字节为整个 invoke 载荷', async () => {
    const store = createTauriStore()
    const bytes = new Uint8Array([1, 2, 3])
    await store.writeIndex(bytes)
    expect(invokeMock).toHaveBeenCalledWith('storage_write_index', bytes)
  })

  it('putMedia 将 Blob 转为 Uint8Array 参数', async () => {
    const store = createTauriStore()
    await store.putMedia(7, 'a', new Blob([new Uint8Array([1])]), new Blob([new Uint8Array([2])]))
    expect(invokeMock).toHaveBeenCalledWith('storage_put_media', {
      day: 7,
      id: 'a',
      full: new Uint8Array([1]),
      thumb: new Uint8Array([2]),
    })
  })

  it('writeFile 透传路径与字节', async () => {
    const store = createTauriStore()
    const data = new Uint8Array([5, 6])
    await store.writeFile(['ext', 'memo', 'memos.json'], data)
    expect(invokeMock).toHaveBeenCalledWith('storage_write_file', {
      path: ['ext', 'memo', 'memos.json'],
      data,
    })
  })
})

describe('其余方法透传', () => {
  it('deleteMedia / removeEntry / listDir / estimateUsage', async () => {
    const store = createTauriStore()
    await store.deleteMedia(7, 'a')
    expect(invokeMock).toHaveBeenCalledWith('storage_delete_media', { day: 7, id: 'a' })
    await store.removeEntry(['ext', 'memo'])
    expect(invokeMock).toHaveBeenCalledWith('storage_remove_entry', { path: ['ext', 'memo'] })
    invokeMock.mockResolvedValue({ dirs: ['sub'], files: ['a.json'] })
    expect(await store.listDir(['ext'])).toEqual({ dirs: ['sub'], files: ['a.json'] })
    invokeMock.mockResolvedValue({
      usage: 100,
      quota: 2000,
      breakdown: { days: 60, media: 30, ext: 8, system: 2 },
    })
    expect(await store.estimateUsage()).toEqual({
      usage: 100,
      quota: 2000,
      breakdown: { days: 60, media: 30, ext: 8, system: 2 },
    })
  })
})
