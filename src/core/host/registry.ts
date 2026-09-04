/**
 * 内置扩展注册表：构建期经 import.meta.glob 静态收集 extensions 下的扩展包，
 * manifest 立即载入，视图/工具组件与覆盖层 provider 懒加载，随主应用打包，离线天然可用。
 * 外部扩展（阶段 5）走独立的运行时安装路径，与本表无关。
 *
 * 覆盖层 provider 约定：manifest 声明 contributes.gridOverlays 的扩展必须提供
 * src/overlay.ts，默认导出名为 start 的函数（启动推送，可返回清理函数）。
 * 日记弹层工具约定：contributes.dayEditorTools 声明的组件与视图组件同目录（views/），
 * 接收 DayEditorToolProps（context + date + dayIndex），由日记编辑器在打开时懒加载渲染。
 */

import type { Component } from 'svelte'
import type { ExtensionContext } from './context'
import { parseManifest, type ExtensionManifest, type Platform } from './manifest'

/** 视图组件懒加载器（Svelte 5 组件）。 */
export type ViewLoader = () => Promise<{ default: Component }>

/** 覆盖层 provider 模块形态：start 启动推送，可返回清理函数（停用时调用）。 */
export type OverlayProviderModule = {
  start: (ctx: ExtensionContext) => void | (() => void)
}

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

/** 已注册的覆盖层贡献：声明的层 id 列表 + provider 懒加载器。 */
export type ContributedOverlay = {
  /** 声明的层 id（setOverlays 的合法 layer 参数）。 */
  layers: string[]
  /** provider 模块懒加载器。 */
  load: () => Promise<OverlayProviderModule>
}

/** 日记弹层工具组件的 props 契约（Host 注入）。 */
export type DayEditorToolProps = {
  /** 扩展上下文（与视图注入一致）。 */
  context: ExtensionContext
  /** 当前编辑日的日期（YYYY-MM-DD，本地日历日）。 */
  date: string
  /** 当前编辑日的日索引。 */
  dayIndex: number
}

/** 已注册的日记弹层工具贡献：id 为全局 id（<extId>/<toolId>）。 */
export type ContributedTool = {
  /** 全局工具 id（<extId>/<toolId>）。 */
  id: string
  /** 所属扩展 id。 */
  extId: string
  /** 分区显示名。 */
  label: string
  /** 组件懒加载器（props 见 DayEditorToolProps）。 */
  load: ViewLoader
}

/** 已注册扩展：manifest + 按当前平台过滤后的贡献。 */
export type RegisteredExtension = {
  manifest: ExtensionManifest
  views: ContributedView[]
  /** 覆盖层贡献；未声明 gridOverlays 为 null。 */
  overlay: ContributedOverlay | null
  /** 日记弹层工具贡献（无声明为空数组）。 */
  tools: ContributedTool[]
}

/** 当前运行平台；Tauri webview 注入 __TAURI_INTERNALS__，非浏览器环境（单测）按 pwa 计。 */
export function currentPlatform(): Platform {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window ? 'desktop' : 'pwa'
}

// 构建期收集：manifest 立即载入（eager），视图组件与覆盖层 provider 懒加载
const manifestModules = import.meta.glob('/extensions/*/manifest.json', {
  eager: true,
  import: 'default',
})
const viewModules = import.meta.glob('/extensions/*/views/*.svelte') as Record<string, ViewLoader>
const overlayModules = import.meta.glob('/extensions/*/src/overlay.ts') as Record<
  string,
  () => Promise<OverlayProviderModule>
>

/** 由 glob 结果构建注册表；manifest 非法或组件/ provider 缺失时抛错（构建/启动期暴露）。 */
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
    const tools = (manifest.contributes.dayEditorTools ?? []).map((t): ContributedTool => {
      const load = viewModules[`${dir}/${t.component}`]
      if (!load) {
        throw new Error(`扩展 ${manifest.id} 的工具组件不存在：${t.component}`)
      }
      return { id: `${manifest.id}/${t.id}`, extId: manifest.id, label: t.label, load }
    })
    const overlayLayers = manifest.contributes.gridOverlays ?? []
    let overlay: ContributedOverlay | null = null
    if (overlayLayers.length > 0) {
      const load = overlayModules[`${dir}/src/overlay.ts`]
      if (!load) {
        throw new Error(`扩展 ${manifest.id} 声明了 gridOverlays 但缺少 src/overlay.ts`)
      }
      overlay = { layers: overlayLayers.map((o) => o.id), load }
    }
    result.push({ manifest, views, overlay, tools })
  }
  return result
}

/** 内置扩展注册表（当前平台适用的子集）。 */
export const builtinExtensions: RegisteredExtension[] = buildRegistry()
