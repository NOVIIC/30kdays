import { describe, it, expect, beforeAll } from 'vitest'
import { createOverviewImageData } from '../../src/grid/renderOverview'

class MockImageData {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
}

beforeAll(() => {
  ;(globalThis as { ImageData: unknown }).ImageData = MockImageData
})

describe('renderOverview', () => {
  it('should create ImageData of correct size', () => {
    const colors = Array(100).fill('#ff0000')
    const data = createOverviewImageData(10, 10, 100, colors)
    expect(data.width).toBe(10)
    expect(data.height).toBe(10)
  })

  it('should set pixels to correct color', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff']
    const data = createOverviewImageData(3, 1, 3, colors)
    // First pixel: red
    expect(data.data[0]).toBe(255)
    expect(data.data[1]).toBe(0)
    expect(data.data[2]).toBe(0)
    expect(data.data[3]).toBe(255)
    // Second pixel: green
    expect(data.data[4]).toBe(0)
    expect(data.data[5]).toBe(255)
    expect(data.data[6]).toBe(0)
    // Third pixel: blue
    expect(data.data[8]).toBe(0)
    expect(data.data[9]).toBe(0)
    expect(data.data[10]).toBe(255)
  })

  it('should handle partial last row', () => {
    const colors = Array(95).fill('#ff0000')
    const data = createOverviewImageData(10, 10, 95, colors)
    expect(data.width).toBe(10)
    expect(data.height).toBe(10)
  })
})
