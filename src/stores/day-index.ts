/**
 * 日索引状态：内存中的 DayIndex（Uint8Array 逐格标志位）。
 * 启动时从 index.bin 载入；不存在则建空写盘；长度不符（如寿命调整）
 * 按截断/补零迁移，格式版本不符则按全空重建（决策见 crt.md）。
 */

import { get, writable } from 'svelte/store'
import type { LifeConfig } from '../core/domain'
import {
  createDayIndex,
  DAY_INDEX_FORMAT_VERSION,
  serializeDayIndex,
  totalDays,
} from '../core/domain'
import type { StorageBackend } from '../core/storage'

/** 当前日索引；尚未载入（启动中或无配置）时为空数组。 */
export const dayIndex = writable<Uint8Array>(new Uint8Array(0))

/** 建空索引并写盘，返回内存态。 */
async function resetIndex(backend: StorageBackend, total: number): Promise<Uint8Array> {
  const empty = createDayIndex(total)
  await backend.writeIndex(serializeDayIndex(empty))
  return empty
}

/**
 * 启动时载入日索引：
 * - index.bin 不存在 → 建空并写盘；
 * - 格式版本不符 → 告警后按全空重建并写盘；
 * - 长度与总天数不符 → 截断或补零迁移（保留既有标志位）并写盘。
 */
export async function loadDayIndex(backend: StorageBackend, cfg: LifeConfig): Promise<void> {
  const total = totalDays(cfg)
  const bytes = await backend.readIndex()

  if (bytes === null) {
    dayIndex.set(await resetIndex(backend, total))
    return
  }
  if (bytes.length === 0 || bytes[0] !== DAY_INDEX_FORMAT_VERSION) {
    console.warn('index.bin 格式版本不符，按全空重建')
    dayIndex.set(await resetIndex(backend, total))
    return
  }
  const body = bytes.slice(1)
  if (body.length !== total) {
    const migrated = new Uint8Array(total)
    migrated.set(body.subarray(0, Math.min(body.length, total)))
    await backend.writeIndex(serializeDayIndex(migrated))
    dayIndex.set(migrated)
    return
  }
  dayIndex.set(body)
}

/**
 * 更新某天的标志位：与内存现值比较，有变化才更新内存并写盘；
 * 无变化不写盘（标志位仅在「空↔非空」跳变时变化，天然低频，免防抖）。
 * 索引越界时忽略。写盘成功后才更新内存态，失败不破坏内存与磁盘的一致性。
 */
export async function setDayFlags(
  backend: StorageBackend,
  day: number,
  flags: number,
): Promise<void> {
  const current = get(dayIndex)
  if (day < 0 || day >= current.length) return
  if (current[day] === flags) return
  const next = current.slice()
  next[day] = flags
  await backend.writeIndex(serializeDayIndex(next))
  dayIndex.set(next)
}
