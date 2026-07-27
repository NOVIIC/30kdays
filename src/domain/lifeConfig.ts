export type LifeConfig = {
  birthdate: string
  lifespanYears: number
  version: number
}

export const DEFAULT_LIFESPAN = 80
const MS_PER_DAY = 86_400_000

function utcTimestamp(dateStr: string): number {
  return Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10))
  )
}

export function totalDays(config: LifeConfig): number {
  const birth = utcTimestamp(config.birthdate)
  const endYear = parseInt(config.birthdate.slice(0, 4)) + config.lifespanYears
  const end = Date.UTC(
    endYear,
    parseInt(config.birthdate.slice(5, 7)) - 1,
    parseInt(config.birthdate.slice(8, 10))
  )
  return Math.round((end - birth) / MS_PER_DAY)
}

export function dateOf(index: number, config: LifeConfig): Date {
  const birth = utcTimestamp(config.birthdate)
  return new Date(birth + index * MS_PER_DAY)
}

export function indexOf(date: Date, config: LifeConfig): number {
  const birth = utcTimestamp(config.birthdate)
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.round((target - birth) / MS_PER_DAY)
}

export function todayIndex(config: LifeConfig): number {
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const birth = utcTimestamp(config.birthdate)
  const idx = Math.round((today - birth) / MS_PER_DAY)
  const total = totalDays(config)
  return Math.max(0, Math.min(idx, total - 1))
}

export function isPast(index: number, todayIdx: number): boolean {
  return index < todayIdx
}

export function isToday(index: number, todayIdx: number): boolean {
  return index === todayIdx
}

export function isFuture(index: number, todayIdx: number): boolean {
  return index > todayIdx
}
