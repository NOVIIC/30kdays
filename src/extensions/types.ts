/**
 * 扩展系统类型定义。
 *
 * 设计依据见 extension-plan.md §3（manifest）与 §5（host API）。
 * 阶段 1 只落地 doc.* + log.*；grid/net/config 等留到阶段 2/3。
 */

export type ExtensionPermission =
  | 'doc:read'
  | 'doc:write'
  | 'grid:read'
  | 'grid:overlay'
  | 'net:fetch'
  | 'config:read'
  | 'config:write'

/** 视图 tab 贡献：注册到 SideNav + 路由 + 动态加载的 Svelte 组件 */
export interface ViewContribution {
  /** 路由 id，全局唯一 */
  id: string
  label: string
  icon: string
  /** 视图组件路径（相对扩展包根，由宿主动态 import） */
  component: string
}

export interface ExtensionContributes {
  views?: ViewContribution[]
  // 阶段 2 追加: dayEditorTools, gridOverlays
  // 阶段 3 追加: settings
}

export interface ExtensionManifest {
  /** 全局唯一 */
  id: string
  name: string
  version: string
  /** logic wasm glue 路径（相对扩展包根，wasm-pack --target web 产出的 .js） */
  main: string
  permissions: ExtensionPermission[]
  contributes: ExtensionContributes
}

export type ExtensionOrigin = 'builtin' | 'external'

export interface ExtensionMeta {
  manifest: ExtensionManifest
  origin: ExtensionOrigin
  enabled: boolean
}

/**
 * 宿主注入 wasm 的能力 API。
 * wasm 默认无 I/O，所有能力经 wasm-bindgen host imports（extern "C"）调到这里。
 * 视图层（Svelte）也通过同一套白名单 API 访问数据，不直接碰 storageService。
 */
export interface HostApi {
  doc: {
    read<T = unknown>(name: string): Promise<T | null>
    write<T = unknown>(name: string, data: T): Promise<void>
  }
  log: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
  }
}
