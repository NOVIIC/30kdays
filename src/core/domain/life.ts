/**
 * 人生配置与日期 ↔ 日索引换算。
 * 日期（YYYY-MM-DD）内部以 UTC 零点表示并做算术，避免本地时区与夏令时影响换算；
 * 但「今天是哪一天」按本地日历判定（todayIndex）。
 * 过去 / 今天 / 未来由 todayIndex 实时派生，不入库。
 */

/** LifeConfig 的当前格式版本。 */
export const LIFE_CONFIG_VERSION = 1

/** 默认预期寿命（年）。 */
export const DEFAULT_LIFESPAN_YEARS = 80

/** 人生配置：网格的生成依据，持久化于 config.json。 */
export type LifeConfig = {
  /** 出生日期，YYYY-MM-DD。 */
  birthdate: string
  /** 预期寿命（年），决定网格总天数。 */
  lifespanYears: number
  /** 配置格式版本，见 LIFE_CONFIG_VERSION。 */
  version: number
}

/** 某一天相对今天的状态。 */
export type DayStatus = 'past' | 'today' | 'future'

/** 一天的毫秒数（UTC 下每天恒为 86400 秒，无夏令时）。 */
const MS_PER_DAY = 86_400_000

/** YYYY-MM-DD 的格式校验正则。 */
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 解析 YYYY-MM-DD 为 UTC 零点时间戳；格式错误或日期不存在时抛错。 */
export function parseISODate(date: string): number {
  const m = DATE_RE.exec(date)
  if (!m) throw new Error(`无效的日期格式：${date}`)
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const t = Date.UTC(y, mo - 1, d)
  // Date.UTC 会把 2 月 30 日这类不存在的日期顺延，回检分量以拒绝
  const dt = new Date(t)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`无效的日期：${date}`)
  }
  return t
}

/** UTC 时间戳 → YYYY-MM-DD。 */
export function formatISODate(t: number): string {
  const d = new Date(t)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** Date 的本地日历日 → YYYY-MM-DD（取本地年月日，用于「今天」判定）。 */
export function localISODate(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** 创建人生配置；birthdate 与 lifespanYears 非法时抛错。 */
export function createLifeConfig(
  birthdate: string,
  lifespanYears: number = DEFAULT_LIFESPAN_YEARS,
): LifeConfig {
  parseISODate(birthdate) // 校验
  if (!Number.isInteger(lifespanYears) || lifespanYears <= 0) {
    throw new Error(`无效的预期寿命：${lifespanYears}`)
  }
  return { birthdate, lifespanYears, version: LIFE_CONFIG_VERSION }
}

/** 校验从存储读出的配置是否合法。 */
export function isValidLifeConfig(config: unknown): config is LifeConfig {
  if (typeof config !== 'object' || config === null) return false
  const c = config as Record<string, unknown>
  if (typeof c.birthdate !== 'string') return false
  if (typeof c.lifespanYears !== 'number') return false
  if (typeof c.version !== 'number') return false
  try {
    createLifeConfig(c.birthdate, c.lifespanYears)
  } catch {
    return false
  }
  return true
}

/**
 * 总天数：从出生日到 N 年后同月同日之间的天数（含闰日）。
 * 2 月 29 日出生在非闰年目标时顺延到 3 月 1 日，保持换算一致。
 */
export function totalDays(config: LifeConfig): number {
  const birth = parseISODate(config.birthdate)
  const d = new Date(birth)
  const end = Date.UTC(d.getUTCFullYear() + config.lifespanYears, d.getUTCMonth(), d.getUTCDate())
  return (end - birth) / MS_PER_DAY
}

/** 日期 → 日索引（出生日为 0）。可能为负或超出总天数，调用方自行判断范围。 */
export function indexOf(config: LifeConfig, date: string): number {
  return (parseISODate(date) - parseISODate(config.birthdate)) / MS_PER_DAY
}

/** 日索引 → 日期。索引超出 [0, totalDays) 时抛错。 */
export function dateOf(config: LifeConfig, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= totalDays(config)) {
    throw new RangeError(`日索引越界：${index}`)
  }
  return formatISODate(parseISODate(config.birthdate) + index * MS_PER_DAY)
}

/** 今天对应的日索引，按本地日历日判定；出生前为负。now 可注入以便测试。 */
export function todayIndex(config: LifeConfig, now: Date = new Date()): number {
  return indexOf(config, localISODate(now))
}

/** 某一天相对今天的状态：过去 / 今天 / 未来。 */
export function dayStatus(index: number, today: number): DayStatus {
  if (index < today) return 'past'
  if (index > today) return 'future'
  return 'today'
}
