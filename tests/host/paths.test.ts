import { describe, expect, it } from 'vitest'
import { resolveExtensionPath, validateSegment } from '../../src/core/host/paths'

describe('validateSegment', () => {
  it('接受常规名字与中文名', () => {
    expect(() => validateSegment('memos.json')).not.toThrow()
    expect(() => validateSegment('备忘.json')).not.toThrow()
    expect(() => validateSegment('2026-08_26.md')).not.toThrow()
  })

  it('拒绝空段、. 与 ..', () => {
    expect(() => validateSegment('')).toThrow()
    expect(() => validateSegment('.')).toThrow()
    expect(() => validateSegment('..')).toThrow()
  })

  it('拒绝分隔符与控制字符', () => {
    expect(() => validateSegment('a/b')).toThrow()
    expect(() => validateSegment('a\\b')).toThrow()
    expect(() => validateSegment('a\tb')).toThrow()
    expect(() => validateSegment('a\0b')).toThrow()
  })

  it('拒绝以点或空格结尾（Windows 兼容性）', () => {
    expect(() => validateSegment('name.')).toThrow()
    expect(() => validateSegment('name ')).toThrow()
    expect(() => validateSegment('.hidden')).not.toThrow()
  })

  it('拒绝超长段', () => {
    expect(() => validateSegment('x'.repeat(128))).not.toThrow()
    expect(() => validateSegment('x'.repeat(129))).toThrow()
  })
})

describe('resolveExtensionPath', () => {
  it('拼上 ext/<ext-id>/ 前缀', () => {
    expect(resolveExtensionPath('memo', ['memos.json'])).toEqual(['ext', 'memo', 'memos.json'])
    expect(resolveExtensionPath('todo', ['archive', '2026.json'])).toEqual([
      'ext',
      'todo',
      'archive',
      '2026.json',
    ])
  })

  it('空路径默认拒绝，allowEmpty 时指向扩展文件夹自身', () => {
    expect(() => resolveExtensionPath('memo', [])).toThrow()
    expect(resolveExtensionPath('memo', [], { allowEmpty: true })).toEqual(['ext', 'memo'])
  })

  it('拒绝过深路径', () => {
    const deep = Array.from({ length: 9 }, (_, i) => `d${i}`)
    expect(() => resolveExtensionPath('memo', deep)).toThrow()
    expect(resolveExtensionPath('memo', deep.slice(0, 8))).toHaveLength(10)
  })

  it('extId 同样按段规则校验', () => {
    expect(() => resolveExtensionPath('../memo', ['a.json'])).toThrow()
    expect(() => resolveExtensionPath('a/b', ['a.json'])).toThrow()
  })

  it('任何段非法即拒绝（含伪装穿越）', () => {
    expect(() => resolveExtensionPath('memo', ['..', 'config.json'])).toThrow()
    expect(() => resolveExtensionPath('memo', ['sub', '..', 'config.json'])).toThrow()
    expect(() => resolveExtensionPath('memo', ['a\\b'])).toThrow()
  })
})
