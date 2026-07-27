import { describe, it, expect } from 'vitest'
import { dayFill, lightGridColors, darkGridColors, type GridColors } from '../../src/grid/palette'

const themes: [string, GridColors][] = [
  ['light', lightGridColors],
  ['dark', darkGridColors],
]

describe.each(themes)('palette (%s theme)', (_name, colors) => {
  it('future days use future color', () => {
    expect(dayFill(colors, { isPast: false, isToday: false, hasContent: false })).toBe(
      colors.future,
    )
  })

  it('past empty vs past content differ', () => {
    const empty = dayFill(colors, { isPast: true, isToday: false, hasContent: false })
    const content = dayFill(colors, { isPast: true, isToday: false, hasContent: true })
    expect(empty).toBe(colors.pastEmpty)
    expect(content).toBe(colors.pastContent)
    expect(content).not.toBe(empty)
  })

  it('today uses accent regardless of content', () => {
    expect(dayFill(colors, { isPast: false, isToday: true, hasContent: false })).toBe(colors.today)
    expect(dayFill(colors, { isPast: false, isToday: true, hasContent: true })).toBe(colors.today)
  })

  it('all colors are valid hex strings', () => {
    for (const v of Object.values(colors)) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('palette (theme contrast)', () => {
  it('content stands out from empty past in both themes', () => {
    // 内容日与空白过去日在两个主题下都应有足够区分（不同色即可）
    for (const [, colors] of themes) {
      expect(colors.pastContent).not.toBe(colors.pastEmpty)
      expect(colors.today).toBe(colors.accent)
    }
  })
})
