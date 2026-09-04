import { describe, expect, it } from 'vitest'
import {
  mixHexColor,
  mixPacked,
  mixRgb,
  packColor,
  packHexColor,
  parseHexColor,
  toHexColor,
  unpackColor,
} from '../../src/core/grid/colors'

describe('parseHexColor', () => {
  it('解析 #rrggbb', () => {
    expect(parseHexColor('#b0724a')).toEqual([176, 114, 74])
    expect(parseHexColor('#000000')).toEqual([0, 0, 0])
    expect(parseHexColor('#FFFFFF')).toEqual([255, 255, 255])
  })

  it('拒绝非法格式', () => {
    expect(() => parseHexColor('#fff')).toThrow()
    expect(() => parseHexColor('red')).toThrow()
    expect(() => parseHexColor('#gg0000')).toThrow()
  })
})

describe('packColor / packHexColor', () => {
  it('打包为小端 ABGR', () => {
    expect(packColor([0x12, 0x34, 0x56])).toBe(0xff563412)
  })

  it('不透明', () => {
    expect(packHexColor('#000000') >>> 24).toBe(255)
  })

  it('与 parseHexColor 组合一致', () => {
    expect(packHexColor('#b0724a')).toBe(packColor([176, 114, 74]))
  })
})

describe('unpackColor / toHexColor', () => {
  it('与打包/解析互逆', () => {
    expect(unpackColor(packColor([0x12, 0x34, 0x56]))).toEqual([0x12, 0x34, 0x56])
    expect(toHexColor([176, 114, 74])).toBe('#b0724a')
    expect(toHexColor(parseHexColor('#09af00'))).toBe('#09af00')
  })
})

describe('mixPacked / mixHexColor（覆盖层染色混入）', () => {
  it('强度 0 不变、1 完全替换、0.5 取中', () => {
    expect(mixRgb([0, 0, 0], [200, 100, 40], 0)).toEqual([0, 0, 0])
    expect(mixRgb([0, 0, 0], [200, 100, 40], 1)).toEqual([200, 100, 40])
    expect(mixRgb([0, 0, 0], [200, 100, 40], 0.5)).toEqual([100, 50, 20])
  })

  it('打包像素混入与 RGB 混入一致', () => {
    const base = packHexColor('#c9c0ac')
    const mixed = mixPacked(base, packHexColor('#c2611e'), 1)
    expect(unpackColor(mixed)).toEqual([0xc2, 0x61, 0x1e])
    expect(mixed >>> 24).toBe(255) // 保持不透明
  })

  it('hex 混入返回 #rrggbb', () => {
    expect(mixHexColor('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHexColor('#b0724a', '#000000', 0)).toBe('#b0724a')
  })
})
