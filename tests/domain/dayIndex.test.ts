import { describe, it, expect } from 'vitest'
import {
  createDayIndex,
  getFlags,
  setFlags,
  hasContent,
  FLAG_HAS_TEXT,
  FLAG_HAS_IMAGE,
} from '../../src/domain/dayIndex'

describe('dayIndex', () => {
  it('should create index with correct length', () => {
    const idx = createDayIndex(100)
    expect(idx.length).toBe(100)
  })

  it('should create zero-initialized index', () => {
    const idx = createDayIndex(10)
    for (let i = 0; i < 10; i++) {
      expect(idx[i]).toBe(0)
    }
  })

  it('should get and set flags', () => {
    const idx = createDayIndex(5)
    setFlags(idx, 2, FLAG_HAS_TEXT)
    expect(getFlags(idx, 2)).toBe(FLAG_HAS_TEXT)
    expect(getFlags(idx, 0)).toBe(0)
  })

  it('should combine flags', () => {
    const idx = createDayIndex(5)
    setFlags(idx, 1, FLAG_HAS_TEXT | FLAG_HAS_IMAGE)
    expect(getFlags(idx, 1)).toBe(FLAG_HAS_TEXT | FLAG_HAS_IMAGE)
  })

  it('should detect content', () => {
    const idx = createDayIndex(5)
    expect(hasContent(idx, 0)).toBe(false)
    setFlags(idx, 0, FLAG_HAS_TEXT)
    expect(hasContent(idx, 0)).toBe(true)
    setFlags(idx, 0, 0)
    expect(hasContent(idx, 0)).toBe(false)
  })
})
