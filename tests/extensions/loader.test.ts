import { describe, test, expect } from 'vitest'
import { validateManifest } from '../../src/extensions/loader'
import type { ExtensionManifest } from '../../src/extensions/types'

const valid: ExtensionManifest = {
  id: 'memo',
  name: '备忘',
  version: '1.0.0',
  main: 'logic.js',
  permissions: ['doc:read', 'doc:write'],
  contributes: {
    views: [{ id: 'memos', label: '备忘', icon: 'note', component: 'views/MemoView.svelte' }],
  },
}

describe('validateManifest', () => {
  test('合法 manifest 原样返回', () => {
    expect(validateManifest(valid)).toEqual(valid)
  })
  test('缺 id 报错', () => {
    expect(() => validateManifest({ ...valid, id: '' })).toThrow(/id/)
  })
  test('缺 main 报错', () => {
    expect(() => validateManifest({ ...valid, main: '' })).toThrow(/main/)
  })
  test('未知 permission 报错', () => {
    expect(() =>
      validateManifest({ ...valid, permissions: ['doc:read', 'hack:all'] }),
    ).toThrow(/unknown permission/)
  })
  test('contributes.views 缺 component 报错', () => {
    const m = { ...valid, contributes: { views: [{ id: 'x', label: 'x', icon: 'x' }] } }
    expect(() => validateManifest(m)).toThrow(/component/)
  })
  test('permissions 非 array 报错', () => {
    expect(() =>
      validateManifest({ ...valid, permissions: 'doc:read' as unknown as string[] }),
    ).toThrow(/permissions/)
  })
  test('非对象报错', () => {
    expect(() => validateManifest(null)).toThrow(/object/)
    expect(() => validateManifest('foo')).toThrow(/object/)
  })
})
