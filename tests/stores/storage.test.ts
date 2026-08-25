import { beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'

/** 替代真实存储 Worker 的 readConfig 行为（由 vi.mock 注入）。 */
const readConfig = vi.hoisted(() => vi.fn())

vi.mock('../../src/core/storage', () => ({
  createStorageBackend: () => ({ readConfig }),
}))

describe('boot', () => {
  beforeEach(() => {
    vi.resetModules()
    readConfig.mockReset()
  })

  it('读配置失败时进入 error 态并记录错误信息', async () => {
    readConfig.mockRejectedValue(new Error('OPFS 不可用'))
    const { boot, bootState, bootError } = await import('../../src/stores/storage')
    await boot()
    expect(get(bootState)).toBe('error')
    expect(get(bootError)).toBe('OPFS 不可用')
  })

  it('无配置时进入 onboarding', async () => {
    readConfig.mockResolvedValue(null)
    const { boot, bootState } = await import('../../src/stores/storage')
    await boot()
    expect(get(bootState)).toBe('onboarding')
  })

  it('重试成功后进入 ready', async () => {
    readConfig.mockRejectedValueOnce(new Error('OPFS 不可用'))
    const { boot, bootState } = await import('../../src/stores/storage')
    await boot()
    expect(get(bootState)).toBe('error')
    readConfig.mockResolvedValue(null)
    await boot()
    expect(get(bootState)).toBe('onboarding')
  })
})
