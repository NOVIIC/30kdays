import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from 'svelte/store'

/** 替代真实存储 Worker 的读写行为（由 vi.mock 注入）。 */
const mocks = vi.hoisted(() => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
  writeIndex: vi.fn(),
}))
const { readConfig, writeConfig, writeIndex } = mocks

vi.mock('../../src/core/storage', () => ({
  createStorageBackend: () => mocks,
  isTauri: () => false,
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

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.resetModules()
    writeConfig.mockReset()
    writeIndex.mockReset()
  })

  it('写入配置与空索引后进入 ready，内存日索引同步为全空（点格立即可用）', async () => {
    const { createLifeConfig, totalDays } = await import('../../src/core/domain')
    const { completeOnboarding, bootState } = await import('../../src/stores/storage')
    const { dayIndex } = await import('../../src/stores/day-index')
    const { config } = await import('../../src/stores/config')
    const cfg = createLifeConfig('2000-01-01', 80)

    await completeOnboarding(cfg)

    expect(writeConfig).toHaveBeenCalledWith(cfg)
    expect(writeIndex).toHaveBeenCalledOnce()
    expect(get(bootState)).toBe('ready')
    expect(get(config)).toEqual(cfg)
    expect(get(dayIndex).length).toBe(totalDays(cfg))
    expect(get(dayIndex).every((f) => f === 0)).toBe(true)
  })
})

describe('持久化存储', () => {
  /** 注入假的 navigator.storage（persisted/persist）。 */
  function stubStorageManager(persisted: boolean, granted: boolean) {
    const mgr = {
      persisted: vi.fn(async () => persisted),
      persist: vi.fn(async () => granted),
    }
    vi.stubGlobal('navigator', { storage: mgr })
    return mgr
  }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('已持久化时仅记录状态，不再申请', async () => {
    const mgr = stubStorageManager(true, true)
    const { ensurePersistence, storagePersisted } = await import('../../src/stores/storage')
    await ensurePersistence()
    expect(get(storagePersisted)).toBe(true)
    expect(mgr.persist).not.toHaveBeenCalled()
  })

  it('未持久化时自动申请一次并记录结果', async () => {
    const mgr = stubStorageManager(false, false)
    const { ensurePersistence, storagePersisted } = await import('../../src/stores/storage')
    await ensurePersistence()
    expect(mgr.persist).toHaveBeenCalledOnce()
    expect(get(storagePersisted)).toBe(false)
  })

  it('API 不可用时保持 null（设置页隐藏申请入口）', async () => {
    vi.stubGlobal('navigator', {})
    const { ensurePersistence, storagePersisted } = await import('../../src/stores/storage')
    await ensurePersistence()
    expect(get(storagePersisted)).toBeNull()
  })

  it('手动申请：调用 persist 并更新状态', async () => {
    stubStorageManager(false, true)
    const { requestPersistence, storagePersisted } = await import('../../src/stores/storage')
    expect(await requestPersistence()).toBe(true)
    expect(get(storagePersisted)).toBe(true)
  })
})
