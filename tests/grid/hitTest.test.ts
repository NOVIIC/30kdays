import { describe, it, expect } from 'vitest'
import { indexFromPoint } from '../../src/grid/hitTest'
import type { Layout } from '../../src/grid/layout'

const layout: Layout = {
  cols: 10,
  rows: 5,
  cellSize: 20,
  totalDays: 48,
}

describe('hitTest', () => {
  it('should return index for valid point', () => {
    expect(indexFromPoint(layout, 0, 0)).toBe(0)
    expect(indexFromPoint(layout, 19, 19)).toBe(0)
    expect(indexFromPoint(layout, 20, 0)).toBe(1)
    expect(indexFromPoint(layout, 0, 20)).toBe(10)
    expect(indexFromPoint(layout, 40, 40)).toBe(22)
  })

  it('should return null for out-of-bounds', () => {
    expect(indexFromPoint(layout, -1, 0)).toBeNull()
    expect(indexFromPoint(layout, 0, -1)).toBeNull()
    expect(indexFromPoint(layout, 200, 0)).toBeNull()
    expect(indexFromPoint(layout, 0, 100)).toBeNull()
  })

  it('should return null for index beyond totalDays', () => {
    expect(indexFromPoint(layout, 160, 80)).toBeNull()
  })

  it('should return null for zero cellSize', () => {
    const bad: Layout = { cols: 10, rows: 10, cellSize: 0, totalDays: 100 }
    expect(indexFromPoint(bad, 50, 50)).toBeNull()
  })
})
