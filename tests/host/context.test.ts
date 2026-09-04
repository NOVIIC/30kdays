import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExtensionContext } from '../../src/core/host/context'
import { parseManifest } from '../../src/core/host/manifest'
import { OverlayHub } from '../../src/core/host/overlay'
import { createOpfsStore } from '../../src/core/storage/opfs-store'
import { createFakeOpfsRoot } from '../storage/fake-opfs'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 构造指定权限与覆盖层声明的 manifest。 */
function manifest(permissions: string[], gridOverlays: { id: string }[] = []) {
  return parseManifest({
    id: 'memo',
    name: '备忘',
    version: '0.1.0',
    permissions,
    platforms: ['pwa'],
    contributes: gridOverlays.length > 0 ? { gridOverlays } : undefined,
  })
}

/** 恒为 0 的 dateToIndex（全部指令落在日索引 0）。 */
const hub = () => new OverlayHub(() => 0)

describe('createExtensionContext', () => {
  it('fs 按声明权限放行，落在 ext/<id>/ 作用域', async () => {
    const backend = createOpfsStore(createFakeOpfsRoot())
    const ctx = createExtensionContext(backend, manifest(['fs:read', 'fs:write']), hub())
    await ctx.fs.writeJson(['memos.json'], [])
    expect(await ctx.fs.readJson(['memos.json'])).toEqual([])
    expect(await backend.readFile(['ext', 'memo', 'memos.json'])).not.toBeNull()
  })

  it('未声明 fs:write 时写操作异步拒绝', async () => {
    const ctx = createExtensionContext(
      createOpfsStore(createFakeOpfsRoot()),
      manifest(['fs:read']),
      hub(),
    )
    await expect(ctx.fs.writeJson(['a.json'], {})).rejects.toThrow('fs:write')
    await expect(ctx.fs.remove(['a.json'])).rejects.toThrow('fs:write')
    await expect(ctx.fs.readJson(['a.json'])).resolves.toBeNull()
  })

  it('未声明 fs:read 时读操作异步拒绝', async () => {
    const ctx = createExtensionContext(
      createOpfsStore(createFakeOpfsRoot()),
      manifest(['fs:write']),
      hub(),
    )
    await expect(ctx.fs.readFile(['a.json'])).rejects.toThrow('fs:read')
    await expect(ctx.fs.listDir()).rejects.toThrow('fs:read')
  })

  it('log 带扩展前缀输出', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const ctx = createExtensionContext(createOpfsStore(createFakeOpfsRoot()), manifest([]), hub())
    ctx.log.info('hello', 42)
    expect(spy).toHaveBeenCalledWith('[ext:memo]', 'hello', 42)
  })

  it('grid.setOverlays 推送到已声明的层', async () => {
    const h = hub()
    const ctx = createExtensionContext(
      createOpfsStore(createFakeOpfsRoot()),
      manifest([], [{ id: 'schedule' }]),
      h,
    )
    await ctx.grid.setOverlays('schedule', [{ date: '2026-09-10', dot: { color: '#c2611e' } }])
    expect(h.describe()).toEqual([{ extId: 'memo', layerId: 'schedule', count: 1 }])
  })

  it('grid.setOverlays 对未声明的层异步拒绝', async () => {
    const ctx = createExtensionContext(
      createOpfsStore(createFakeOpfsRoot()),
      manifest([], [{ id: 'schedule' }]),
      hub(),
    )
    await expect(
      ctx.grid.setOverlays('other', [{ date: '2026-09-10', dot: { color: '#c2611e' } }]),
    ).rejects.toThrow('未声明覆盖层')
  })

  it('grid.setOverlays 对非法指令异步拒绝', async () => {
    const ctx = createExtensionContext(
      createOpfsStore(createFakeOpfsRoot()),
      manifest([], [{ id: 'schedule' }]),
      hub(),
    )
    await expect(ctx.grid.setOverlays('schedule', [{ date: 'bad' }] as never)).rejects.toThrow(
      'date',
    )
  })
})
