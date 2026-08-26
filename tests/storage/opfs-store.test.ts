import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpfsStore } from '../../src/core/storage/opfs-store'
import { createLifeConfig } from '../../src/core/domain/life'
import { createEmptyDayDoc } from '../../src/core/domain/day-doc'
import { serializeDayIndex } from '../../src/core/domain/day-index'
import { createFakeOpfsRoot } from './fake-opfs'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('config', () => {
  it('未初始化时返回 null', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.readConfig()).toBeNull()
  })

  it('写入后可读回', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const config = createLifeConfig('2000-01-01', 80)
    await store.writeConfig(config)
    expect(await store.readConfig()).toEqual(config)
  })
})

describe('index.bin', () => {
  it('不存在时返回 null', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.readIndex()).toBeNull()
  })

  it('字节级往返一致（含版本头）', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const bytes = serializeDayIndex(new Uint8Array([1, 0, 2, 3]))
    await store.writeIndex(bytes)
    expect(await store.readIndex()).toEqual(bytes)
  })
})

describe('days/<n>.json', () => {
  it('不存在时返回 null', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.readDayDoc(42)).toBeNull()
  })

  it('按天读写互不干扰', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const doc0 = { ...createEmptyDayDoc(), text: '第一天', updatedAt: 1 }
    const doc1 = { ...createEmptyDayDoc(), text: '第二天', updatedAt: 2 }
    await store.writeDayDoc(0, doc0)
    await store.writeDayDoc(1, doc1)
    expect(await store.readDayDoc(0)).toEqual(doc0)
    expect(await store.readDayDoc(1)).toEqual(doc1)
  })
})

describe('media/<n>/<id>', () => {
  it('目录不存在时 getMedia 返回 null', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.getMedia(0, 'a', 'full')).toBeNull()
  })

  it('完整图与缩略图分别存取', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const full = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    const thumb = new Blob([new Uint8Array([4])], { type: 'image/webp' })
    await store.putMedia(7, 'a', full, thumb)
    expect(new Uint8Array(await (await store.getMedia(7, 'a', 'full'))!.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    )
    expect(new Uint8Array(await (await store.getMedia(7, 'a', 'thumb'))!.arrayBuffer())).toEqual(
      new Uint8Array([4]),
    )
  })

  it('deleteMedia 一并删除完整图与缩略图', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    await store.putMedia(7, 'a', new Blob(['x']), new Blob(['y']))
    await store.deleteMedia(7, 'a')
    expect(await store.getMedia(7, 'a', 'full')).toBeNull()
    expect(await store.getMedia(7, 'a', 'thumb')).toBeNull()
  })

  it('删除不存在的附件不抛错', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    await expect(store.deleteMedia(7, 'missing')).resolves.toBeUndefined()
  })
})

describe('文件 API（readFile / writeFile / listDir / removeEntry）', () => {
  const enc = new TextEncoder()

  it('文件不存在时 readFile 返回 null', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.readFile(['ext', 'memo', 'memos.json'])).toBeNull()
  })

  it('writeFile 逐级创建目录，字节级往返一致', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    const bytes = enc.encode(JSON.stringify([{ id: 't1', text: '买菜' }]))
    await store.writeFile(['ext', 'todo', 'archive', 'todos.json'], bytes)
    expect(await store.readFile(['ext', 'todo', 'archive', 'todos.json'])).toEqual(bytes)
  })

  it('listDir 区分子目录与文件；目录不存在返回 null', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.listDir(['ext', 'memo'])).toBeNull()
    await store.writeFile(['ext', 'memo', 'a.json'], enc.encode('1'))
    await store.writeFile(['ext', 'memo', 'sub', 'b.json'], enc.encode('2'))
    expect(await store.listDir(['ext', 'memo'])).toEqual({ dirs: ['sub'], files: ['a.json'] })
  })

  it('removeEntry 删除文件；不存在不报错', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    await store.writeFile(['ext', 'memo', 'a.json'], enc.encode('1'))
    await store.removeEntry(['ext', 'memo', 'a.json'])
    expect(await store.readFile(['ext', 'memo', 'a.json'])).toBeNull()
    await expect(store.removeEntry(['ext', 'memo', 'missing.json'])).resolves.toBeUndefined()
    await expect(store.removeEntry(['ext', 'missing', 'a.json'])).resolves.toBeUndefined()
  })

  it('removeEntry 递归删除目录', async () => {
    const store = createOpfsStore(createFakeOpfsRoot())
    await store.writeFile(['ext', 'memo', 'sub', 'b.json'], enc.encode('2'))
    await store.removeEntry(['ext', 'memo'])
    expect(await store.listDir(['ext', 'memo'])).toBeNull()
  })
})

describe('estimateUsage', () => {
  it('透传 navigator.storage.estimate 并兜底缺省字段', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ usage: 100, quota: 2000 }) },
    })
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.estimateUsage()).toEqual({ usage: 100, quota: 2000 })
  })

  it('字段缺失时按 0 处理', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({}) } })
    const store = createOpfsStore(createFakeOpfsRoot())
    expect(await store.estimateUsage()).toEqual({ usage: 0, quota: 0 })
  })
})
