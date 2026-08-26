import { describe, expect, it } from 'vitest'
import { parseManifest } from '../../src/core/host/manifest'

/** 最小合法 manifest。 */
function valid() {
  return {
    id: 'memo',
    name: '备忘',
    version: '0.1.0',
    permissions: ['fs:read', 'fs:write'],
    platforms: ['pwa', 'desktop'],
    contributes: {
      views: [{ id: 'memos', label: '备忘', icon: 'note', component: 'views/MemoView.svelte' }],
    },
  }
}

describe('parseManifest', () => {
  it('解析合法 manifest（含视图贡献）', () => {
    const m = parseManifest(valid())
    expect(m.id).toBe('memo')
    expect(m.contributes.views).toHaveLength(1)
    expect(m.contributes.views![0].component).toBe('views/MemoView.svelte')
  })

  it('contributes 缺省为空对象；main 可选', () => {
    const raw = valid() as Record<string, unknown>
    delete raw.contributes
    const m = parseManifest(raw)
    expect(m.contributes).toEqual({})
    expect(m.main).toBeUndefined()
  })

  it('拒绝非对象与缺失字段', () => {
    expect(() => parseManifest(null)).toThrow('manifest 非法')
    expect(() => parseManifest([])).toThrow('manifest 非法')
    expect(() => parseManifest({ ...valid(), name: '' })).toThrow('name')
  })

  it('id 按路径段规则校验（拒绝穿越与分隔符）', () => {
    expect(() => parseManifest({ ...valid(), id: 'a/b' })).toThrow('id')
    expect(() => parseManifest({ ...valid(), id: '..' })).toThrow('id')
  })

  it('拒绝未知权限与非字符串权限', () => {
    expect(() => parseManifest({ ...valid(), permissions: ['root'] })).toThrow('未知权限')
    expect(() => parseManifest({ ...valid(), permissions: [1] })).toThrow('permissions')
  })

  it('platforms 必须非空且取值合法', () => {
    expect(() => parseManifest({ ...valid(), platforms: [] })).toThrow('platforms')
    expect(() => parseManifest({ ...valid(), platforms: ['web'] })).toThrow('platforms')
  })

  it('拒绝重复视图 id', () => {
    const raw = valid()
    raw.contributes.views.push(raw.contributes.views[0])
    expect(() => parseManifest(raw)).toThrow('重复')
  })

  it('视图 component 拒绝目录穿越', () => {
    const raw = valid()
    raw.contributes.views[0].component = '../escape.svelte'
    expect(() => parseManifest(raw)).toThrow('component')
    raw.contributes.views[0].component = 'views/sub/Ok.svelte'
    expect(() => parseManifest(raw)).not.toThrow()
  })
})
