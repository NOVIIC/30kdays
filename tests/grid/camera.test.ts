import { describe, it, expect } from 'vitest'
import { createCamera, screenToWorld, worldToScreen, zoomAt } from '../../src/grid/camera'

describe('camera', () => {
  it('createCamera should return identity camera', () => {
    const c = createCamera()
    expect(c.scale).toBe(1)
    expect(c.offsetX).toBe(0)
    expect(c.offsetY).toBe(0)
  })

  describe('screenToWorld', () => {
    it('should convert at identity', () => {
      const w = screenToWorld(createCamera(), 100, 200)
      expect(w.x).toBe(100)
      expect(w.y).toBe(200)
    })

    it('should apply scale', () => {
      const c = { scale: 2, offsetX: 0, offsetY: 0 }
      const w = screenToWorld(c, 100, 200)
      expect(w.x).toBe(50)
      expect(w.y).toBe(100)
    })

    it('should apply offset', () => {
      const c = { scale: 1, offsetX: 10, offsetY: 20 }
      const w = screenToWorld(c, 0, 0)
      expect(w.x).toBe(10)
      expect(w.y).toBe(20)
    })
  })

  describe('worldToScreen', () => {
    it('should be inverse of screenToWorld', () => {
      const c = { scale: 2, offsetX: -30, offsetY: 50 }
      const s = worldToScreen(c, 100, 200)
      const w = screenToWorld(c, s.x, s.y)
      expect(w.x).toBeCloseTo(100)
      expect(w.y).toBeCloseTo(200)
    })
  })

  describe('zoomAt', () => {
    it('should zoom around a point', () => {
      const c = { scale: 1, offsetX: 0, offsetY: 0 }
      const zoomed = zoomAt(c, 50, 50, 2)
      // World point at (50, 50) should still be at screen (50, 50)
      const w = screenToWorld(zoomed, 50, 50)
      expect(w.x).toBeCloseTo(50)
      expect(w.y).toBeCloseTo(50)
    })

    it('should zoom out around a point', () => {
      const c = { scale: 2, offsetX: 100, offsetY: 100 }
      const zoomed = zoomAt(c, 50, 50, 0.5)
      const w = screenToWorld(zoomed, 50, 50)
      const original = screenToWorld(c, 50, 50)
      expect(w.x).toBeCloseTo(original.x)
      expect(w.y).toBeCloseTo(original.y)
    })
  })
})
