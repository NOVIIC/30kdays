export const FLAG_HAS_TEXT = 1 << 0
export const FLAG_HAS_IMAGE = 1 << 1

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
