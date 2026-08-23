import { describe, expect, it } from 'vitest'
import {
  createDayIndex,
  DAY_INDEX_FORMAT_VERSION,
  FLAG_MEDIA,
  FLAG_TEXT,
  flagsOfDoc,
  hasFlag,
  parseDayIndex,
  serializeDayIndex,
  setFlag,
} from '../../src/core/domain/day-index'
import { createEmptyDayDoc } from '../../src/core/domain/day-doc'

describe('DayIndex 标志位', () => {
  it('初始全为 0', () => {
    const index = createDayIndex(10)
    expect(index.length).toBe(10)
    expect(hasFlag(index, 5, FLAG_TEXT)).toBe(false)
  })

  it('置位与清除互不影响其它位', () => {
    const index = createDayIndex(10)
    setFlag(index, 3, FLAG_TEXT, true)
    setFlag(index, 3, FLAG_MEDIA, true)
    expect(index[3]).toBe(FLAG_TEXT | FLAG_MEDIA)

    setFlag(index, 3, FLAG_TEXT, false)
    expect(hasFlag(index, 3, FLAG_TEXT)).toBe(false)
    expect(hasFlag(index, 3, FLAG_MEDIA)).toBe(true)

    expect(index[4]).toBe(0) // 相邻格不受影响
  })
})

describe('flagsOfDoc', () => {
  it('空文档无标志', () => {
    expect(flagsOfDoc(createEmptyDayDoc())).toBe(0)
  })

  it('纯空白文字不算有内容', () => {
    const doc = { ...createEmptyDayDoc(), text: '  \n ' }
    expect(flagsOfDoc(doc)).toBe(0)
  })

  it('文字与图片分别置位', () => {
    const textOnly = { ...createEmptyDayDoc(), text: 'hi' }
    expect(flagsOfDoc(textOnly)).toBe(FLAG_TEXT)

    const withMedia = {
      ...createEmptyDayDoc(),
      media: [{ id: 'a', name: 'a.webp', w: 100, h: 100, type: 'image/webp' }],
    }
    expect(flagsOfDoc(withMedia)).toBe(FLAG_MEDIA)
  })
})

describe('index.bin 编解码', () => {
  it('往返一致', () => {
    const index = createDayIndex(30000)
    setFlag(index, 0, FLAG_TEXT, true)
    setFlag(index, 29999, FLAG_MEDIA, true)

    const bytes = serializeDayIndex(index)
    expect(bytes[0]).toBe(DAY_INDEX_FORMAT_VERSION)
    expect(bytes.length).toBe(30001)

    const parsed = parseDayIndex(bytes, 30000)
    expect(parsed).toEqual(index)
  })

  it('长度不符抛错', () => {
    const bytes = serializeDayIndex(createDayIndex(10))
    expect(() => parseDayIndex(bytes, 11)).toThrow()
  })

  it('版本不符抛错', () => {
    const bytes = serializeDayIndex(createDayIndex(10))
    bytes[0] = 99
    expect(() => parseDayIndex(bytes, 10)).toThrow()
  })
})
