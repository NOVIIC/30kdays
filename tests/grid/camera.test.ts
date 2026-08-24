import { describe, expect, it } from 'vitest'
import {
  createCamera,
  fitCamera,
  MAX_SCALE,
  MIN_SCALE,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from '../../src/core/grid/camera'
import { computeLayout } from '../../src/core/grid/layout'

describe('worldToScreen / screenToWorld', () => {
  it('单位相机下坐标不变', () => {
    const c = createCamera()
    expect(worldToScreen(c, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
  })

  it('往返一致', () => {
    const c = { scale: 2, x: 10, y: -5 }
    const p = { x: 123, y: 456 }
    expect(screenToWorld(c, worldToScreen(c, p))).toEqual(p)
  })
})

describe('fitCamera', () => {
  it('scale = 1 且网格居中', () => {
    const l = computeLayout(100, 1000, 1000)
    const c = fitCamera(l, 1200, 1000)
    expect(c.scale).toBe(1)
    expect(c.x).toBe(100) // (1200 - 1000) / 2
    expect(c.y).toBe(0)
  })
})

describe('panBy', () => {
  it('累加屏幕偏移', () => {
    const c = panBy({ scale: 2, x: 10, y: 20 }, 5, -8)
    expect(c).toEqual({ scale: 2, x: 15, y: 12 })
  })
})

describe('zoomAt', () => {
  it('缩放前后 pivot 对应的世界点不变', () => {
    const c = { scale: 1, x: 30, y: -10 }
    const pivot = { x: 200, y: 150 }
    const before = screenToWorld(c, pivot)
    const after = screenToWorld(zoomAt(c, pivot, 2), pivot)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('放大 2 倍', () => {
    const c = zoomAt(createCamera(), { x: 100, y: 100 }, 2)
    expect(c.scale).toBe(2)
    // 世界点 (100,100) 仍映射到屏幕 (100,100)
    expect(c.x).toBe(-100)
    expect(c.y).toBe(-100)
  })

  it('倍率夹在 [MIN_SCALE, MAX_SCALE]', () => {
    const c = createCamera()
    expect(zoomAt(c, { x: 0, y: 0 }, 1000).scale).toBe(MAX_SCALE)
    expect(zoomAt(c, { x: 0, y: 0 }, 0.001).scale).toBe(MIN_SCALE)
  })

  it('到达边界后不再变化', () => {
    const atMax = zoomAt(createCamera(), { x: 0, y: 0 }, MAX_SCALE)
    expect(zoomAt(atMax, { x: 0, y: 0 }, 2)).toBe(atMax)
  })
})
