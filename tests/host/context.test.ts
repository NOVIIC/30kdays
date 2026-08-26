import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExtensionContext } from '../../src/core/host/context'
import { parseManifest } from '../../src/core/host/manifest'
import { createOpfsStore } from '../../src/core/storage/opfs-store'
import { createFakeOpfsRoot } from '../storage/fake-opfs'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 构造指定权限的 manifest。 */
function manifest(permissions: string[]) {
  return parseManifest({
    id: 'memo',
    name: '备忘',
    version: '0.1.0',
    permissions,
    platforms: ['pwa'],
  })
}

describe('createExtensionContext', () => {
  it('fs 按声明权限放行，落在 ext/<id>/ 作用域', async () => {
    const backend = createOpfsStore(createFakeOpfsRoot())
    const ctx = createExtensionContext(backend, manifest(['fs:read', 'fs:write']))
    await ctx.fs.writeJson(['memos.json'], [])
    expect(await ctx.fs.readJson(['memos.json'])).toEqual([])
    expect(await backend.readFile(['ext', 'memo', 'memos.json'])).not.toBeNull()
  })

  it('未声明 fs:write 时写操作异步拒绝', async () => {
    const ctx = createExtensionContext(createOpfsStore(createFakeOpfsRoot()), manifest(['fs:read']))
    await expect(ctx.fs.writeJson(['a.json'], {})).rejects.toThrow('fs:write')
    await expect(ctx.fs.remove(['a.json'])).rejects.toThrow('fs:write')
    await expect(ctx.fs.readJson(['a.json'])).resolves.toBeNull()
  })

  it('未声明 fs:read 时读操作异步拒绝', async () => {
    const ctx = createExtensionContext(
      createOpfsStore(createFakeOpfsRoot()),
      manifest(['fs:write']),
    )
    await expect(ctx.fs.readFile(['a.json'])).rejects.toThrow('fs:read')
    await expect(ctx.fs.listDir()).rejects.toThrow('fs:read')
  })

  it('log 带扩展前缀输出', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const ctx = createExtensionContext(createOpfsStore(createFakeOpfsRoot()), manifest([]))
    ctx.log.info('hello', 42)
    expect(spy).toHaveBeenCalledWith('[ext:memo]', 'hello', 42)
  })
})
