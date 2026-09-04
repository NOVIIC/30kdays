import { describe, expect, it } from 'vitest'
import {
  compareMemos,
  createMemo,
  formatMemoTime,
  MEMO_FORMAT_VERSION,
  memoPath,
  parseMemo,
  type Memo,
} from '../../extensions/memo/src/memos'

/** 构造测试用备忘。 */
function memo(partial: Partial<Memo> & { id: string }): Memo {
  return { text: '', updatedAt: 0, version: MEMO_FORMAT_VERSION, ...partial }
}

describe('memoPath', () => {
  it('指向 memos/<id>.json', () => {
    expect(memoPath('abc')).toEqual(['memos', 'abc.json'])
  })
})

describe('createMemo', () => {
  it('生成带版本头的空备忘', () => {
    expect(createMemo('id-1', 123)).toEqual({
      id: 'id-1',
      text: '',
      updatedAt: 123,
      version: MEMO_FORMAT_VERSION,
    })
  })
})

describe('parseMemo', () => {
  it('接受合法文档并归一化版本号', () => {
    const raw = { id: 'a', text: '买菜', updatedAt: 100, version: 1 }
    expect(parseMemo(raw)).toEqual({ id: 'a', text: '买菜', updatedAt: 100, version: 1 })
  })

  it('拒绝非对象与缺字段', () => {
    expect(parseMemo(null)).toBeNull()
    expect(parseMemo('str')).toBeNull()
    expect(parseMemo({ text: 'x', updatedAt: 1 })).toBeNull()
    expect(parseMemo({ id: '', text: 'x', updatedAt: 1 })).toBeNull()
    expect(parseMemo({ id: 'a', updatedAt: 1 })).toBeNull()
    expect(parseMemo({ id: 'a', text: 'x' })).toBeNull()
    expect(parseMemo({ id: 'a', text: 'x', updatedAt: NaN })).toBeNull()
  })
})

describe('compareMemos', () => {
  it('按 updatedAt 倒序', () => {
    const list = [
      memo({ id: 'a', updatedAt: 1 }),
      memo({ id: 'b', updatedAt: 3 }),
      memo({ id: 'c', updatedAt: 2 }),
    ]
    expect([...list].sort(compareMemos).map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })

  it('updatedAt 相同按 id 稳定排序', () => {
    const list = [memo({ id: 'b', updatedAt: 1 }), memo({ id: 'a', updatedAt: 1 })]
    expect([...list].sort(compareMemos).map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('formatMemoTime', () => {
  const now = new Date(2026, 8, 4, 12, 0)

  it('当年省略年份', () => {
    expect(formatMemoTime(new Date(2026, 0, 5, 9, 7).getTime(), now)).toBe('1月5日 09:07')
  })

  it('跨年带年份', () => {
    expect(formatMemoTime(new Date(2025, 11, 31, 23, 5).getTime(), now)).toBe(
      '2025年12月31日 23:05',
    )
  })
})
