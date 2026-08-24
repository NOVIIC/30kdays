import { describe, expect, it } from 'vitest'
import { cellCoord, cellOrigin, computeLayout } from '../../src/core/grid/layout'

describe('computeLayout', () => {
  it('方形视口：100 格排成 10×10', () => {
    const l = computeLayout(100, 1000, 1000)
    expect(l.cols).toBe(10)
    expect(l.rows).toBe(10)
    expect(l.cell).toBe(100)
    expect(l.width).toBe(1000)
    expect(l.height).toBe(1000)
  })

  it('宽屏视口：列数随宽高比增大', () => {
    // sqrt(29220 × 1920/1080) ≈ 227.9 → 228 列
    const l = computeLayout(29220, 1920, 1080)
    expect(l.cols).toBe(228)
    expect(l.rows).toBe(129)
    // 网格贴合屏幕：不超出视口
    expect(l.width).toBeLessThanOrEqual(1920)
    expect(l.height).toBeLessThanOrEqual(1080)
  })

  it('竖屏视口：列数减少、行数增多', () => {
    const l = computeLayout(100, 500, 1000)
    expect(l.cols).toBe(7)
    expect(l.rows).toBe(15)
    // 浮点误差容忍 1e-9
    expect(l.width).toBeLessThanOrEqual(500 + 1e-9)
    expect(l.height).toBeLessThanOrEqual(1000 + 1e-9)
  })

  it('格子数恰好占满最后一行', () => {
    const l = computeLayout(16, 400, 400)
    expect(l.cols).toBe(4)
    expect(l.rows).toBe(4)
  })

  it('拒绝非法入参', () => {
    expect(() => computeLayout(0, 1000, 1000)).toThrow()
    expect(() => computeLayout(-5, 1000, 1000)).toThrow()
    expect(() => computeLayout(100, 0, 1000)).toThrow()
    expect(() => computeLayout(100, 1000, -1)).toThrow()
  })
})

describe('cellCoord / cellOrigin', () => {
  const l = computeLayout(100, 1000, 1000)

  it('索引 0 在左上角', () => {
    expect(cellCoord(l, 0)).toEqual({ col: 0, row: 0 })
    expect(cellOrigin(l, 0)).toEqual({ x: 0, y: 0 })
  })

  it('按行优先排列', () => {
    expect(cellCoord(l, 15)).toEqual({ col: 5, row: 1 })
    expect(cellOrigin(l, 15)).toEqual({ x: 500, y: 100 })
    expect(cellCoord(l, 99)).toEqual({ col: 9, row: 9 })
  })

  it('索引越界抛错', () => {
    expect(() => cellCoord(l, -1)).toThrow(RangeError)
    expect(() => cellCoord(l, 100)).toThrow(RangeError)
    expect(() => cellOrigin(l, 100)).toThrow(RangeError)
  })
})
