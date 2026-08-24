import { describe, expect, it } from 'vitest'
import { packColor, packHexColor, parseHexColor } from '../../src/core/grid/colors'

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
