import { describe, expect, it } from 'vitest'
import { createEmptyDayDoc, DAY_DOC_VERSION } from '../../src/core/domain/day-doc'

describe('createEmptyDayDoc', () => {
  it('返回空的版本化文档', () => {
    expect(createEmptyDayDoc()).toEqual({
      text: '',
      media: [],
      updatedAt: 0,
      version: DAY_DOC_VERSION,
    })
  })

  it('每次返回独立副本', () => {
    const a = createEmptyDayDoc()
    const b = createEmptyDayDoc()
    a.media.push({ id: 'x', name: 'x.webp', w: 1, h: 1, type: 'image/webp' })
    expect(b.media).toHaveLength(0)
  })
})
