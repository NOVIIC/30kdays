import { describe, expect, it } from 'vitest'
import { builtinExtensions } from '../../src/core/host/registry'

describe('builtinExtensions（构建时静态注册表）', () => {
  it('收集到内置 memo 扩展及其视图贡献', () => {
    const memo = builtinExtensions.find((e) => e.manifest.id === 'memo')
    expect(memo).toBeDefined()
    expect(memo!.manifest.name).toBe('备忘')
    expect(memo!.views).toHaveLength(1)
    expect(memo!.views[0]).toMatchObject({
      id: 'memo/memos',
      extId: 'memo',
      label: '备忘',
      icon: 'note',
    })
    expect(typeof memo!.views[0].load).toBe('function')
  })

  it('manifest 权限与平台经 parseManifest 校验后可用', () => {
    const memo = builtinExtensions.find((e) => e.manifest.id === 'memo')!
    expect(memo.manifest.permissions).toEqual(['fs:read', 'fs:write'])
    expect(memo.manifest.platforms).toContain('pwa')
  })
})
