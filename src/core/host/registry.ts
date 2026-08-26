/**
 * 内置扩展注册表：构建期经 import.meta.glob 静态收集 extensions 下的扩展包，
 * manifest 与视图组件随主应用打包，离线天然可用。
 * 外部扩展（阶段 4）走独立的运行时安装路径，与本表无关。
 */

import type { Component } from 'svelte'
import { parseManifest, type ExtensionManifest, type Platform } from './manifest'

/** 视图组件懒加载器（Svelte 5 组件）。 */
export type ViewLoader = () => Promise<{ default: Component }>

/** 已注册的视图贡献：id 为路由/导航命名空间内的全局 id（<extId>/<viewId>）。 */
export type ContributedView = {
  /** 全局视图 id（<extId>/<viewId>），即 hash 路由值。 */
  id: string
  /** 所属扩展 id。 */
  extId: string
  /** 导航显示名。 */
  label: string
  /** 导航图标名。 */
  icon: string
  /** 组件懒加载器。 */
  load: ViewLoader
}

/** 已注册扩展：manifest + 按当前平台过滤后的视图贡献。 */
export type RegisteredExtension = {
  manifest: ExtensionManifest
  views: ContributedView[]
}

/** 当前运行平台；Tauri webview 注入 __TAURI_INTERNALS__，非浏览器环境（单测）按 pwa 计。 */
export function currentPlatform(): Platform {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window ? 'desktop' : 'pwa'
}

// 构建期收集：manifest 立即载入（eager），视图组件懒加载
const manifestModules = import.meta.glob('/extensions/*/manifest.json', {
  eager: true,
  import: 'default',
})
const viewModules = import.meta.glob('/extensions/*/views/*.svelte') as Record<string, ViewLoader>

/** 由 glob 结果构建注册表；manifest 非法或组件缺失时抛错（构建/启动期暴露）。 */
function buildRegistry(): RegisteredExtension[] {
  const platform = currentPlatform()
  const result: RegisteredExtension[] = []
  for (const [path, raw] of Object.entries(manifestModules)) {
    const manifest = parseManifest(raw)
    if (!manifest.platforms.includes(platform)) continue
    const dir = path.slice(0, -'/manifest.json'.length)
    const views = (manifest.contributes.views ?? []).map((v): ContributedView => {
      const load = viewModules[`${dir}/${v.component}`]
      if (!load) {
        throw new Error(`扩展 ${manifest.id} 的视图组件不存在：${v.component}`)
      }
      return {
        id: `${manifest.id}/${v.id}`,
        extId: manifest.id,
        label: v.label,
        icon: v.icon,
        load,
      }
    })
    result.push({ manifest, views })
  }
  return result
}

/** 内置扩展注册表（当前平台适用的子集）。 */
export const builtinExtensions: RegisteredExtension[] = buildRegistry()
