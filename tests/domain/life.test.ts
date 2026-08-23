import { describe, expect, it } from 'vitest'
import {
  createLifeConfig,
  dateOf,
  dayStatus,
  formatISODate,
  indexOf,
  isValidLifeConfig,
  localISODate,
  parseISODate,
  todayIndex,
  totalDays,
} from '../../src/core/domain/life'

const config = createLifeConfig('2000-01-01', 80)

describe('parseISODate / formatISODate', () => {
  it('往返一致', () => {
    expect(formatISODate(parseISODate('2024-02-29'))).toBe('2024-02-29')
  })

  it('拒绝非法格式', () => {
    expect(() => parseISODate('2000-1-1')).toThrow()
    expect(() => parseISODate('2000/01/01')).toThrow()
    expect(() => parseISODate('')).toThrow()
  })

  it('拒绝不存在的日期', () => {
    expect(() => parseISODate('2023-02-29')).toThrow() // 非闰年
    expect(() => parseISODate('2023-13-01')).toThrow()
    expect(() => parseISODate('2023-00-10')).toThrow()
  })
})

describe('createLifeConfig / isValidLifeConfig', () => {
  it('默认寿命 80，版本 1', () => {
    const c = createLifeConfig('1990-06-15')
    expect(c).toEqual({ birthdate: '1990-06-15', lifespanYears: 80, version: 1 })
  })

  it('拒绝非法入参', () => {
    expect(() => createLifeConfig('1990-02-30')).toThrow()
    expect(() => createLifeConfig('1990-01-01', 0)).toThrow()
    expect(() => createLifeConfig('1990-01-01', 1.5)).toThrow()
  })

  it('isValidLifeConfig 校验存储读出的数据', () => {
    expect(isValidLifeConfig(config)).toBe(true)
    expect(isValidLifeConfig(null)).toBe(false)
    expect(isValidLifeConfig({ birthdate: 'x', lifespanYears: 80, version: 1 })).toBe(false)
    expect(isValidLifeConfig({ birthdate: '2000-01-01', lifespanYears: -1, version: 1 })).toBe(
      false,
    )
  })
})

describe('totalDays', () => {
  it('80 年含 20 个闰日', () => {
    // 2000-01-01 → 2080-01-01，闰年 2000..2076 共 20 个
    expect(totalDays(config)).toBe(80 * 365 + 20)
  })

  it('2 月 29 日出生在非闰年目标顺延到 3 月 1 日', () => {
    const c = createLifeConfig('2000-02-29', 1)
    // 2000-02-29 → 2001-03-01 = 366 天
    expect(totalDays(c)).toBe(366)
  })
})

describe('indexOf / dateOf', () => {
  it('出生日为索引 0', () => {
    expect(indexOf(config, '2000-01-01')).toBe(0)
  })

  it('往返一致', () => {
    for (const i of [0, 1, 365, 366, 10000, totalDays(config) - 1]) {
      expect(indexOf(config, dateOf(config, i))).toBe(i)
    }
  })

  it('最后一天是 80 岁生日前一天', () => {
    expect(dateOf(config, totalDays(config) - 1)).toBe('2079-12-31')
  })

  it('出生前为负索引', () => {
    expect(indexOf(config, '1999-12-31')).toBe(-1)
  })

  it('dateOf 越界抛错', () => {
    expect(() => dateOf(config, -1)).toThrow(RangeError)
    expect(() => dateOf(config, totalDays(config))).toThrow(RangeError)
  })
})

describe('todayIndex / dayStatus', () => {
  it('按本地日历日判定今天', () => {
    // new Date(y, m, d, ...) 构造的是本地时间，与时区无关
    const now = new Date(2024, 5, 15, 23, 59) // 本地 2024-06-15 深夜
    expect(todayIndex(config, now)).toBe(indexOf(config, '2024-06-15'))
  })

  it('localISODate 取本地日历日', () => {
    expect(localISODate(new Date(2024, 0, 1, 0, 0))).toBe('2024-01-01')
    expect(localISODate(new Date(2024, 11, 31, 23, 59))).toBe('2024-12-31')
  })

  it('出生前为负', () => {
    expect(todayIndex(config, new Date(1999, 0, 1))).toBeLessThan(0)
  })

  it('dayStatus 三分', () => {
    const today = 100
    expect(dayStatus(99, today)).toBe('past')
    expect(dayStatus(100, today)).toBe('today')
    expect(dayStatus(101, today)).toBe('future')
  })
})
