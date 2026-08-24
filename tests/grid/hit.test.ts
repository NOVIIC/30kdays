import { describe, expect, it } from 'vitest'
import { fitCamera } from '../../src/core/grid/camera'
import { hitTest } from '../../src/core/grid/hit'
import { computeLayout } from '../../src/core/grid/layout'

describe('hitTest', () => {
  it('命中格子中心', () => {
    const l = computeLayout(100, 1000, 1000) // 10×10，cell = 100
    const c = fitCamera(l, 1000, 1000)
    expect(hitTest(l, c, { x: 50, y: 50 })).toBe(0)
    expect(hitTest(l, c, { x: 150, y: 50 })).toBe(1)
    expect(hitTest(l, c, { x: 50, y: 150 })).toBe(10)
    expect(hitTest(l, c, { x: 950, y: 950 })).toBe(99)
  })

  it('网格外返回 null', () => {
    const l = computeLayout(100, 1000, 1000)
    const c = fitCamera(l, 1000, 1000)
    expect(hitTest(l, c, { x: -1, y: 50 })).toBeNull()
    expect(hitTest(l, c, { x: 50, y: -1 })).toBeNull()
    expect(hitTest(l, c, { x: 1001, y: 50 })).toBeNull()
    expect(hitTest(l, c, { x: 50, y: 1001 })).toBeNull()
  })

  it('末行补位区域返回 null', () => {
    const l = computeLayout(10, 400, 400) // 3 列 4 行，cell = 100，末行仅 1 格
    const c = fitCamera(l, 400, 400)
    expect(hitTest(l, c, { x: 50, y: 350 })).toBe(9) // 最后一格
    expect(hitTest(l, c, { x: 150, y: 350 })).toBeNull() // 补位
    expect(hitTest(l, c, { x: 250, y: 350 })).toBeNull()
  })

  it('相机缩放平移后仍命中正确的格子', () => {
    const l = computeLayout(100, 1000, 1000)
    const c = { scale: 2, x: -200, y: 0 } // 世界 (150, 50) → 屏幕 (100, 100)
    expect(hitTest(l, c, { x: 100, y: 100 })).toBe(1)
  })

  it('非法相机返回 null', () => {
    const l = computeLayout(100, 1000, 1000)
    expect(hitTest(l, { scale: 0, x: 0, y: 0 }, { x: 50, y: 50 })).toBeNull()
  })
})
