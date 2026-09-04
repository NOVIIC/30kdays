/**
 * Host 接线：内置扩展注册表的主线程入口与扩展上下文缓存。
 * 扩展视图经 getExtensionContext(extId) 拿到 Host API（fs 按 manifest 权限门控）。
 * gridOverlays 派发点：overlayHub 为应用级覆盖汇集中心；startOverlayProviders()
 * 在配置就绪后启动各扩展的覆盖层 provider（幂等），合并结果经 gridOverlays store 供 GridView 消费。
 */

import { get, readable, type Readable } from 'svelte/store'
import { indexOf, totalDays } from '../core/domain'
import {
  builtinExtensions,
  createExtensionContext,
  OverlayHub,
  type ContributedTool,
  type ContributedView,
  type DayOverlay,
  type ExtensionContext,
} from '../core/host'
import { config } from './config'
import { getBackend } from './storage'

/** 全部内置扩展贡献的视图（当前平台子集），供导航与路由消费。 */
export const extensionViews: ContributedView[] = builtinExtensions.flatMap((ext) => ext.views)

/** 全部内置扩展贡献的日记弹层工具（注册序即展示序），供 DayEditor 工具区消费。 */
export const dayEditorTools: ContributedTool[] = builtinExtensions.flatMap((ext) => ext.tools)

/** 日期 → 日索引（配置未就绪或日期越界时返回 null，对应指令被丢弃）。 */
function dateToIndex(date: string): number | null {
  const c = get(config)
  if (c === null) return null
  const i = indexOf(c, date)
  return i >= 0 && i < totalDays(c) ? i : null
}

/** 应用级覆盖汇集中心（gridOverlays 派发点；观测可经 overlayHub.describe()）。 */
export const overlayHub = new OverlayHub(dateToIndex)

/** 合并后的格子覆盖表（日索引 → 物化覆盖），供 GridView 消费。 */
export const gridOverlays: Readable<ReadonlyMap<number, DayOverlay>> = readable(
  new Map<number, DayOverlay>() as ReadonlyMap<number, DayOverlay>,
  (set) => overlayHub.subscribe((m) => set(m)),
)

const contexts = new Map<string, ExtensionContext>()

/** 获取扩展上下文（按 extId 缓存）；未注册的扩展抛错。 */
export function getExtensionContext(extId: string): ExtensionContext {
  let ctx = contexts.get(extId)
  if (ctx === undefined) {
    const ext = builtinExtensions.find((e) => e.manifest.id === extId)
    if (ext === undefined) throw new Error(`未注册的扩展：${extId}`)
    ctx = createExtensionContext(getBackend(), ext.manifest, overlayHub)
    contexts.set(extId, ctx)
  }
  return ctx
}

let overlayProvidersStarted = false

/**
 * 启动全部内置扩展的覆盖层 provider（幂等）。
 * 须在存储与配置就绪后调用（provider 通常立即读扩展数据并推送指令）。
 */
export function startOverlayProviders(): void {
  if (overlayProvidersStarted) return
  overlayProvidersStarted = true
  for (const ext of builtinExtensions) {
    if (ext.overlay === null) continue
    void ext.overlay.load().then((m) => m.start(getExtensionContext(ext.manifest.id)))
  }
}
