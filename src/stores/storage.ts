/**
 * 存储接线：StorageBackend 单例与启动引导。
 * backend 惰性创建（首次访问时启动存储 Worker）；boot() 在应用启动时调用一次，
 * 载入人生配置与日索引，驱动 App 的启动界面（loading / onboarding / ready / error）。
 */

import { writable } from 'svelte/store'
import type { LifeConfig } from '../core/domain'
import { createDayIndex, serializeDayIndex, totalDays } from '../core/domain'
import { createStorageBackend, type StorageBackend } from '../core/storage'
import { config } from './config'
import { loadDayIndex } from './day-index'

/** 启动状态：loading 读取中 / onboarding 未配置 / ready 就绪 / error 存储不可用。 */
export type BootState = 'loading' | 'onboarding' | 'ready' | 'error'

/** 当前启动状态。 */
export const bootState = writable<BootState>('loading')

/** 启动失败时的错误信息（如 OPFS 不可用）；仅在 error 态下有值。 */
export const bootError = writable<string | null>(null)

/** 持久化存储状态：null=不支持或未知，true=已持久化，false=未持久化（可在设置页申请）。 */
export const storagePersisted = writable<boolean | null>(null)

let backend: StorageBackend | null = null

/** 获取 StorageBackend 单例；首次调用时创建存储 Worker。 */
export function getBackend(): StorageBackend {
  if (!backend) backend = createStorageBackend()
  return backend
}

/**
 * 应用启动引导：读配置，有则载入日索引进入日历，无则进入 Onboarding。
 * 存储不可用（如无 OPFS）或读盘失败时进入 error 态，由 App 展示错误与重试入口。
 */
export async function boot(): Promise<void> {
  bootState.set('loading')
  try {
    const cfg = await getBackend().readConfig()
    if (cfg === null) {
      bootState.set('onboarding')
      return
    }
    await loadDayIndex(getBackend(), cfg)
    config.set(cfg)
    bootState.set('ready')
    void ensurePersistence()
  } catch (err) {
    bootError.set(err instanceof Error ? err.message : String(err))
    bootState.set('error')
  }
}

/** 完成 Onboarding：写入 config.json 与空 index.bin 后进入日历。 */
export async function completeOnboarding(cfg: LifeConfig): Promise<void> {
  const b = getBackend()
  await b.writeConfig(cfg)
  await b.writeIndex(serializeDayIndex(createDayIndex(totalDays(cfg))))
  config.set(cfg)
  bootState.set('ready')
  void ensurePersistence()
}

/**
 * 启动时自动确保持久化存储：已持久化则仅记录状态，未持久化则自动申请一次。
 * API 不可用或调用失败时保持 null（设置页据此隐藏申请入口）。
 * 失败不影响启动，故内部吞错并以 void 调用。
 */
export async function ensurePersistence(): Promise<void> {
  const mgr = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!mgr?.persisted || !mgr?.persist) return
  try {
    storagePersisted.set((await mgr.persisted()) || (await mgr.persist()))
  } catch {
    storagePersisted.set(null)
  }
}

/** 设置页手动申请持久化存储（自动申请被拒后的重试入口）；返回是否已持久化。 */
export async function requestPersistence(): Promise<boolean> {
  const mgr = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!mgr?.persist) return false
  try {
    const granted = await mgr.persist()
    storagePersisted.set(granted)
    return granted
  } catch {
    return false
  }
}

/**
 * 更新人生配置（如设置页调整寿命）：
 * 先写盘，再经 loadDayIndex 按新总天数迁移日索引，最后更新内存态配置。
 * 顺序保证 App 按 {#key $config} 重建日历时日索引已迁移完毕。
 */
export async function updateLifeConfig(next: LifeConfig): Promise<void> {
  const b = getBackend()
  await b.writeConfig(next)
  await loadDayIndex(b, next)
  config.set(next)
}
