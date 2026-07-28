import type { ExtensionMeta, ViewContribution } from './types'

/**
 * 已加载扩展的注册表。
 * 供 UI 查询 contributes（视图 tab 等），与扩展运行时解耦。
 */
export class Registry {
  private extensions = new Map<string, ExtensionMeta>()

  has(id: string): boolean {
    return this.extensions.has(id)
  }

  add(meta: ExtensionMeta): void {
    if (this.extensions.has(meta.manifest.id))
      throw new Error(`extension "${meta.manifest.id}" already loaded`)
    this.extensions.set(meta.manifest.id, meta)
  }

  remove(id: string): void {
    this.extensions.delete(id)
  }

  list(): ExtensionMeta[] {
    return [...this.extensions.values()]
  }

  /** 合并所有已启用扩展的视图贡献，供 SideNav/router 用 */
  getViews(): ViewContribution[] {
    const views: ViewContribution[] = []
    for (const m of this.extensions.values()) {
      if (m.enabled && m.manifest.contributes.views) {
        views.push(...m.manifest.contributes.views)
      }
    }
    return views
  }

  /** 按 view id 反查扩展 id + 组件路径（供 App 动态加载） */
  getViewForRoute(viewId: string): { extId: string; component: string } | null {
    for (const m of this.extensions.values()) {
      const v = m.manifest.contributes.views?.find((vv) => vv.id === viewId)
      if (v) return { extId: m.manifest.id, component: v.component }
    }
    return null
  }
}
