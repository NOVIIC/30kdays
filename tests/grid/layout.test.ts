import { describe, it, expect } from 'vitest'
import { computeLayout } from '../../src/grid/layout'

describe('layout', () => {
  it('should handle zero totalDays', () => {
    const layout = computeLayout(0, 1920, 1080)
    expect(layout.cols).toBe(0)
    expect(layout.rows).toBe(0)
    expect(layout.cellSize).toBe(0)
  })

  it('should produce columns and rows for 30k days at 16:9', () => {
    const layout = computeLayout(29_220, 1920, 1080)
    expect(layout.cols).toBeGreaterThan(100)
    expect(layout.rows).toBeGreaterThan(100)
    expect(layout.cellSize).toBeGreaterThan(0)
    expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(layout.totalDays)
  })

  it('should produce at least enough cells for all days', () => {
    for (const [days, w, h] of [
      [29_220, 1920, 1080],
      [29_220, 390, 844],
      [100, 800, 600],
      [1, 800, 600],
      [365, 1920, 1080],
    ]) {
      const layout = computeLayout(days, w, h)
      expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(days)
    }
  })

  it('should have at least 1 column', () => {
    const layout = computeLayout(10, 1920, 1080)
    expect(layout.cols).toBeGreaterThanOrEqual(1)
    expect(layout.rows).toBeGreaterThanOrEqual(1)
  })

  it('should handle negative viewport gracefully', () => {
    const layout = computeLayout(10, -1, -1)
    expect(layout.cols).toBe(0)
    expect(layout.cellSize).toBe(0)
  })
})
