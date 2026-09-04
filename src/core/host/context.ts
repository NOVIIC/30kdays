/**
 * 扩展上下文：扩展（视图、以及后续的逻辑 Worker）经此拿到 Host API。
 * fs 按 manifest 权限门控：缺 fs:read 则读操作抛错，缺 fs:write 则写操作抛错；
 * grid.setOverlays 按 manifest 贡献点门控：layer 须在 contributes.gridOverlays 声明；
 * 未授权操作统一异步拒绝（与将来经 RPC 暴露给逻辑 Worker 时的语义一致）。
 */

import type { StorageBackend } from '../storage/backend'
import { createHostFs, type HostFs } from './fs'
import { createHostLog, type HostLog } from './log'
import type { ExtensionManifest } from './manifest'
import { parseOverlayInstructions, type OverlayHub, type OverlayInstruction } from './overlay'
import { hasPermission } from './permissions'

/** 提供给扩展的网格 API（host.grid.*）。 */
export type HostGrid = {
  /**
   * 推送某覆盖层的全量指令（整层替换；空数组清除该层）。
   * layer 须在 manifest 的 contributes.gridOverlays 中声明；指令非法或未声明时异步拒绝。
   */
  setOverlays(layer: string, instructions: OverlayInstruction[]): Promise<void>
}

/** 提供给扩展的 Host API 集合。 */
export type ExtensionContext = {
  /** 扩展 id。 */
  extId: string
  /** 作用域文件 API（host.fs.*），按权限门控。 */
  fs: HostFs
  /** 日志（host.log.*）。 */
  log: HostLog
  /** 网格 API（host.grid.*），按贡献点门控。 */
  grid: HostGrid
}

/** 权限不足的拒绝操作：统一异步抛错。 */
function denied(extId: string, perm: string): () => Promise<never> {
  return () => Promise.reject(new Error(`扩展 ${extId} 未声明权限：${perm}`))
}

/** 按 manifest 权限门控 HostFs。 */
function gateFs(manifest: ExtensionManifest, fs: HostFs): HostFs {
  const canRead = hasPermission(manifest, 'fs:read')
  const canWrite = hasPermission(manifest, 'fs:write')
  const denyRead = denied(manifest.id, 'fs:read')
  const denyWrite = denied(manifest.id, 'fs:write')
  return {
    readFile: canRead ? fs.readFile : denyRead,
    readJson: canRead ? fs.readJson : denyRead,
    listDir: canRead ? fs.listDir : denyRead,
    writeFile: canWrite ? fs.writeFile : denyWrite,
    writeJson: canWrite ? fs.writeJson : denyWrite,
    remove: canWrite ? fs.remove : denyWrite,
  }
}

/** 按 manifest 声明的覆盖层门控 HostGrid。 */
function gateGrid(manifest: ExtensionManifest, hub: OverlayHub): HostGrid {
  const declared = new Set((manifest.contributes.gridOverlays ?? []).map((o) => o.id))
  return {
    async setOverlays(layer: string, instructions: OverlayInstruction[]): Promise<void> {
      if (!declared.has(layer)) {
        throw new Error(`扩展 ${manifest.id} 未声明覆盖层：${layer}`)
      }
      hub.set(manifest.id, layer, parseOverlayInstructions(instructions))
    },
  }
}

/** 为指定扩展创建上下文；overlays 为应用级覆盖汇集中心（见 overlay.ts）。 */
export function createExtensionContext(
  backend: StorageBackend,
  manifest: ExtensionManifest,
  overlays: OverlayHub,
): ExtensionContext {
  return {
    extId: manifest.id,
    fs: gateFs(manifest, createHostFs(backend, manifest.id)),
    log: createHostLog(manifest.id),
    grid: gateGrid(manifest, overlays),
  }
}
