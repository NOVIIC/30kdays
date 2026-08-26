import { describe, expect, it } from 'vitest'
import { createHostFs } from '../../src/core/host/fs'
import { createOpfsStore } from '../../src/core/storage/opfs-store'
import { createFakeOpfsRoot } from '../storage/fake-opfs'

/** 以内存假 OPFS 为后端创建 HostFs，贴近真实 OPFS 行为契约。 */
function setup() {
  const backend = createOpfsStore(createFakeOpfsRoot())
  return { backend, fs: createHostFs(backend, 'memo') }
}

describe('HostFs', () => {
  it('writeJson / readJson 往返一致，且落在 ext/<id>/ 下', async () => {
    const { backend, fs } = setup()
    const memos = [{ id: 'm1', text: '买牛奶' }]
    await fs.writeJson(['memos.json'], memos)
    expect(await fs.readJson(['memos.json'])).toEqual(memos)
    // 物理位置验证：核心区域不出现扩展文件
    const raw = await backend.readFile(['ext', 'memo', 'memos.json'])
    expect(new TextDecoder().decode(raw!)).toBe(JSON.stringify(memos))
    expect(await backend.readFile(['memos.json'])).toBeNull()
  })

  it('readFile / writeFile 以字节为原语，可存任意格式', async () => {
    const { fs } = setup()
    const bytes = new Uint8Array([0, 1, 2, 255])
    await fs.writeFile(['blob.bin'], bytes)
    expect(await fs.readFile(['blob.bin'])).toEqual(bytes)
  })

  it('读取不存在的文件返回 null', async () => {
    const { fs } = setup()
    expect(await fs.readFile(['missing.json'])).toBeNull()
    expect(await fs.readJson(['missing.json'])).toBeNull()
  })

  it('扩展之间互相不可见', async () => {
    const backend = createOpfsStore(createFakeOpfsRoot())
    const memoFs = createHostFs(backend, 'memo')
    const todoFs = createHostFs(backend, 'todo')
    await memoFs.writeJson(['data.json'], { secret: 1 })
    expect(await todoFs.readJson(['data.json'])).toBeNull()
    expect(await todoFs.listDir()).toBeNull()
  })

  it('listDir 缺省列扩展文件夹根，子目录结构自组织', async () => {
    const { fs } = setup()
    expect(await fs.listDir()).toBeNull()
    await fs.writeJson(['a.json'], 1)
    await fs.writeJson(['sub', 'b.json'], 2)
    expect(await fs.listDir()).toEqual({ dirs: ['sub'], files: ['a.json'] })
    expect(await fs.listDir(['sub'])).toEqual({ dirs: [], files: ['b.json'] })
  })

  it('remove 删除文件与目录（递归）', async () => {
    const { fs } = setup()
    await fs.writeJson(['sub', 'b.json'], 2)
    await fs.remove(['sub'])
    expect(await fs.listDir(['sub'])).toBeNull()
    await expect(fs.remove(['missing.json'])).resolves.toBeUndefined()
  })

  it('路径穿越被结构性拒绝，写不进出作用域', async () => {
    const { backend, fs } = setup()
    await expect(fs.readFile(['..', 'config.json'])).rejects.toThrow()
    await expect(fs.writeJson(['..', '..', 'evil.json'], {})).rejects.toThrow()
    expect(await backend.readFile(['evil.json'])).toBeNull()
    expect(await backend.readFile(['ext', 'evil.json'])).toBeNull()
  })

  it('readJson 遇到非法 JSON 抛错', async () => {
    const { fs } = setup()
    await fs.writeFile(['bad.json'], new TextEncoder().encode('not json'))
    await expect(fs.readJson(['bad.json'])).rejects.toThrow()
  })
})
