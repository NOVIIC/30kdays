/**
 * 扩展上下文：扩展（视图、以及后续的逻辑 Worker）经此拿到 Host API。
 * fs 按 manifest 权限门控：缺 fs:read 则读操作抛错，缺 fs:write 则写操作抛错；
 * 未授权操作统一异步拒绝，与 fs.ts 的校验失败语义一致。
 */

import type { StorageBackend } from '../storage/backend'
import { createHostFs, type HostFs } from './fs'
import { createHostLog, type HostLog } from './log'
import type { ExtensionManifest } from './manifest'
import { hasPermission } from './permissions'

/** 提供给扩展的 Host API 集合。 */
export type ExtensionContext = {
  /** 扩展 id。 */
  extId: string
  /** 作用域文件 API（host.fs.*），按权限门控。 */
  fs: HostFs
  /** 日志（host.log.*）。 */
  log: HostLog
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

/** 为指定扩展创建上下文。 */
export function createExtensionContext(
  backend: StorageBackend,
  manifest: ExtensionManifest,
): ExtensionContext {
  return {
    extId: manifest.id,
    fs: gateFs(manifest, createHostFs(backend, manifest.id)),
    log: createHostLog(manifest.id),
  }
}
