import { describe, it, expect } from 'vitest'
import {
  totalDays,
  dateOf,
  indexOf,
  todayIndex,
  isPast,
  isToday,
  isFuture,
  type LifeConfig,
} from '../../src/domain/lifeConfig'

const config: LifeConfig = {
  birthdate: '2000-01-01',
  lifespanYears: 80,
  version: 1,
}

describe('lifeConfig', () => {
  describe('totalDays', () => {
    it('should return correct days for 80-year lifespan', () => {
      const days = totalDays(config)
      expect(days).toBeGreaterThan(29_000)
      expect(days).toBeLessThan(30_000)
    })

    it('should return correct days for 1-year lifespan', () => {
      const days = totalDays({ ...config, lifespanYears: 1 })
      expect(days).toBe(366)
    })

    it('should return 0 for 0-year lifespan', () => {
      const days = totalDays({ ...config, lifespanYears: 0 })
      expect(days).toBe(0)
    })
  })

  describe('dateOf', () => {
    it('should return birthdate for index 0', () => {
      const d = dateOf(0, config)
      expect(d.getUTCFullYear()).toBe(2000)
      expect(d.getUTCMonth()).toBe(0)
      expect(d.getUTCDate()).toBe(1)
    })

    it('should advance by days correctly', () => {
      const d = dateOf(1, config)
      expect(d.getUTCDate()).toBe(2)
    })
  })

  describe('indexOf', () => {
    it('should return 0 for birthdate', () => {
      const idx = indexOf(new Date(Date.UTC(2000, 0, 1)), config)
      expect(idx).toBe(0)
    })

    it('should return 1 for the day after birthdate', () => {
      const idx = indexOf(new Date(Date.UTC(2000, 0, 2)), config)
      expect(idx).toBe(1)
    })

    it('should handle leap year correctly', () => {
      const idx = indexOf(new Date(Date.UTC(2000, 2, 1)), config)
      expect(idx).toBe(60)
    })
  })

  describe('roundtrip', () => {
    it('should roundtrip dateOf -> indexOf', () => {
      for (let i = 0; i < totalDays(config); i += 1000) {
        const d = dateOf(i, config)
        expect(indexOf(d, config)).toBe(i)
      }
    })
  })

  describe('todayIndex', () => {
    it('should return a non-negative integer', () => {
      const idx = todayIndex(config)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(idx)).toBe(true)
    })
  })

  describe('time state', () => {
    it('isPast should be true for index < today', () => {
      expect(isPast(0, 5)).toBe(true)
      expect(isPast(4, 5)).toBe(true)
      expect(isPast(5, 5)).toBe(false)
    })

    it('isToday should be true only when equal', () => {
      expect(isToday(5, 5)).toBe(true)
      expect(isToday(6, 5)).toBe(false)
    })

    it('isFuture should be true for index > today', () => {
      expect(isFuture(6, 5)).toBe(true)
      expect(isFuture(5, 5)).toBe(false)
    })
  })
})
