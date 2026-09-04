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

  it('todo 扩展声明了 gridOverlays 并配套 overlay provider', () => {
    const todo = builtinExtensions.find((e) => e.manifest.id === 'todo')
    expect(todo).toBeDefined()
    expect(todo!.overlay).not.toBeNull()
    expect(todo!.overlay!.layers).toEqual(['schedule'])
    expect(typeof todo!.overlay!.load).toBe('function')
    // 未声明 gridOverlays 的扩展无覆盖贡献
    const memo = builtinExtensions.find((e) => e.manifest.id === 'memo')!
    expect(memo.overlay).toBeNull()
  })

  it('todo 扩展声明了 dayEditorTools 并配套工具组件', () => {
    const todo = builtinExtensions.find((e) => e.manifest.id === 'todo')!
    expect(todo.tools).toHaveLength(1)
    expect(todo.tools[0]).toMatchObject({
      id: 'todo/day-todos',
      extId: 'todo',
      label: '待办',
    })
    expect(typeof todo.tools[0].load).toBe('function')
    // 未声明 dayEditorTools 的扩展无工具贡献
    const memo = builtinExtensions.find((e) => e.manifest.id === 'memo')!
    expect(memo.tools).toEqual([])
  })
})
