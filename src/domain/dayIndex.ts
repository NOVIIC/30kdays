export const FLAG_HAS_TEXT = 1 << 0
export const FLAG_HAS_IMAGE = 1 << 1
/** 该天有关联的进行中的 todo（截止日/区间结束日），不落盘，运行时计算 */
export const FLAG_HAS_TODO = 1 << 2

export type DayFlags = number

export function createDayIndex(totalDays: number): Uint8Array {
  return new Uint8Array(totalDays)
}

export function getFlags(index: Uint8Array, n: number): DayFlags {
  return index[n] ?? 0
}

export function setFlags(index: Uint8Array, n: number, flags: DayFlags): void {
  index[n] = flags
}

export function hasContent(index: Uint8Array, n: number): boolean {
  return index[n] !== 0
}
