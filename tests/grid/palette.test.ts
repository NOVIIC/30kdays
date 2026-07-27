import { describe, it, expect } from 'vitest'
import { getDayColor } from '../../src/grid/palette'

describe('palette', () => {
  it('should return future color', () => {
    const c = getDayColor(false, false, false, false)
    expect(c.fill).toBe('#111827')
  })

  it('should return past empty color', () => {
    const c = getDayColor(true, false, false, false)
    expect(c.fill).toBe('#1e293b')
  })

  it('should return past text color different from past empty', () => {
    const empty = getDayColor(true, false, false, false)
    const text = getDayColor(true, false, true, false)
    expect(text.fill).not.toBe(empty.fill)
  })

  it('should return past image color different from past text', () => {
    const text = getDayColor(true, false, true, false)
    const image = getDayColor(true, false, false, true)
    expect(image.fill).not.toBe(text.fill)
  })

  it('should return today color with blue border', () => {
    const c = getDayColor(false, true, false, false)
    expect(c.border).toBe('#60a5fa')
  })

  it('should always return valid color strings', () => {
    const cases: [boolean, boolean, boolean, boolean][] = [
      [false, false, false, false],
      [true, false, false, false],
      [false, true, false, false],
      [true, false, true, false],
      [true, false, false, true],
      [true, false, true, true],
      [false, true, true, true],
    ]
    for (const args of cases) {
      const c = getDayColor(...args)
      expect(c.fill).toMatch(/^#[0-9a-f]{6}$/)
      expect(c.border).toMatch(/^#[0-9a-f]{6}$/)
      expect(c.highlight).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
