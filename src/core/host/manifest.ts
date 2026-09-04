/**
 * 扩展 manifest 的类型与校验（首期子集，见 ARCHITECTURE.md §5.2）。
 * 内置扩展在构建期由 registry.ts 静态收集；外部扩展（阶段 4）运行时加载同一格式。
 */

import { validateSegment } from './paths'

/** 适用平台。 */
export type Platform = 'pwa' | 'desktop'

const PLATFORMS: readonly Platform[] = ['pwa', 'desktop']

/** 已定义的权限（随 Host API 演进扩充）。 */
export const KNOWN_PERMISSIONS: readonly string[] = ['fs:read', 'fs:write']

/** 视图贡献：导航 tab + 路由 + 懒加载视图。 */
export type ViewContribution = {
  /** 视图 id（扩展内唯一）。 */
  id: string
  /** 导航显示名。 */
  label: string
  /** 导航图标名。 */
  icon: string
  /** 视图组件路径（相对扩展目录；内置为 .svelte 源码，发布物为预编译 .js）。 */
  component: string
}

/** 日记弹层工具贡献：日记编辑器正文下方工具区的一个分区。 */
export type ToolContribution = {
  /** 工具 id（扩展内唯一）。 */
  id: string
  /** 分区显示名。 */
  label: string
  /** 工具组件路径（相对扩展目录；与视图组件同规则）。 */
  component: string
}

/** 格子覆盖层贡献：声明后可经 host.grid.setOverlays 推送该层指令。 */
export type OverlayContribution = {
  /** 层 id（扩展内唯一），即 setOverlays 的 layer 参数。 */
  id: string
}

/** 贡献点集合（views、gridOverlays、dayEditorTools 已落地；settings 等按阶段扩充）。 */
export type ExtensionContributes = {
  views?: ViewContribution[]
  gridOverlays?: OverlayContribution[]
  dayEditorTools?: ToolContribution[]
}

/** 扩展清单。 */
export type ExtensionManifest = {
  /** 扩展 id，同时是其数据文件夹名（ext/<id>/），按路径段规则校验。 */
  id: string
  /** 显示名。 */
  name: string
  /** 版本号。 */
  version: string
  /** 逻辑入口（可选，JS 或 wasm，Worker 内加载）；加载器随首个有逻辑的扩展实现。 */
  main?: string
  /** 声明的权限，须属于 KNOWN_PERMISSIONS。 */
  permissions: string[]
  /** 适用平台（非空）。 */
  platforms: Platform[]
  /** 贡献点。 */
  contributes: ExtensionContributes
}

function fail(msg: string): never {
  throw new Error(`manifest 非法：${msg}`)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 校验字符串字段；缺失或类型不符时抛错。 */
function requireString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v === '') fail(`${field} 缺失或不是非空字符串`)
  return v
}

/** 校验组件路径：相对扩展目录的 POSIX 路径，各段合法（防目录穿越）。owner 用于错误信息定位。 */
function parseComponentPath(v: unknown, owner: string): string {
  const component = requireString(v, `${owner} 的 component`)
  const segments = component.split('/')
  for (const seg of segments) {
    try {
      validateSegment(seg)
    } catch {
      fail(`${owner} 的 component 含非法段：${component}`)
    }
  }
  return component
}

/** 校验视图贡献数组；视图 id 重复时抛错。 */
function parseViews(raw: unknown): ViewContribution[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) fail('contributes.views 必须是数组')
  const seen = new Set<string>()
  return raw.map((item): ViewContribution => {
    if (!isRecord(item)) fail('视图贡献必须是对象')
    const id = requireString(item.id, '视图 id')
    if (seen.has(id)) fail(`视图 id 重复：${id}`)
    seen.add(id)
    return {
      id,
      label: requireString(item.label, `视图 ${id} 的 label`),
      icon: requireString(item.icon, `视图 ${id} 的 icon`),
      component: parseComponentPath(item.component, `视图 ${id}`),
    }
  })
}

/** 校验日记弹层工具贡献数组；工具 id 重复时抛错。 */
function parseDayEditorTools(raw: unknown): ToolContribution[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) fail('contributes.dayEditorTools 必须是数组')
  const seen = new Set<string>()
  return raw.map((item): ToolContribution => {
    if (!isRecord(item)) fail('工具贡献必须是对象')
    const id = requireString(item.id, '工具 id')
    if (seen.has(id)) fail(`工具 id 重复：${id}`)
    seen.add(id)
    return {
      id,
      label: requireString(item.label, `工具 ${id} 的 label`),
      component: parseComponentPath(item.component, `工具 ${id}`),
    }
  })
}

/** 校验格子覆盖层贡献数组；层 id 重复时抛错。 */
function parseGridOverlays(raw: unknown): OverlayContribution[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) fail('contributes.gridOverlays 必须是数组')
  const seen = new Set<string>()
  return raw.map((item): OverlayContribution => {
    if (!isRecord(item)) fail('覆盖层贡献必须是对象')
    const id = requireString(item.id, '覆盖层 id')
    if (seen.has(id)) fail(`覆盖层 id 重复：${id}`)
    seen.add(id)
    return { id }
  })
}

/**
 * 解析并校验原始 manifest 数据；非法时抛错（错误信息指明字段）。
 * contributes 缺省为空对象（纯逻辑扩展可无贡献点）。
 */
export function parseManifest(raw: unknown): ExtensionManifest {
  if (!isRecord(raw)) fail('manifest 不是对象')

  const id = requireString(raw.id, 'id')
  try {
    validateSegment(id)
  } catch {
    fail(`id 含非法字符：${id}`)
  }

  const name = requireString(raw.name, 'name')
  const version = requireString(raw.version, 'version')
  if (raw.main !== undefined && typeof raw.main !== 'string') fail('main 必须是字符串')

  if (!Array.isArray(raw.permissions) || raw.permissions.some((p) => typeof p !== 'string')) {
    fail('permissions 必须是字符串数组')
  }
  const unknown = raw.permissions.filter((p) => !KNOWN_PERMISSIONS.includes(p as string))
  if (unknown.length > 0) fail(`未知权限：${unknown.join(', ')}`)

  if (
    !Array.isArray(raw.platforms) ||
    raw.platforms.length === 0 ||
    raw.platforms.some((p) => !PLATFORMS.includes(p as Platform))
  ) {
    fail('platforms 必须是 pwa/desktop 的非空数组')
  }

  if (raw.contributes !== undefined && !isRecord(raw.contributes)) {
    fail('contributes 必须是对象')
  }
  const contributes = isRecord(raw.contributes) ? raw.contributes : undefined
  const views = parseViews(contributes?.views)
  const gridOverlays = parseGridOverlays(contributes?.gridOverlays)
  const dayEditorTools = parseDayEditorTools(contributes?.dayEditorTools)

  return {
    id,
    name,
    version,
    main: raw.main as string | undefined,
    permissions: raw.permissions as string[],
    platforms: raw.platforms as Platform[],
    contributes: {
      ...(views === undefined ? {} : { views }),
      ...(gridOverlays === undefined ? {} : { gridOverlays }),
      ...(dayEditorTools === undefined ? {} : { dayEditorTools }),
    },
  }
}
