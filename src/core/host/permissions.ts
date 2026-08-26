/**
 * 权限检查：Host API 在创建扩展上下文时按 manifest 声明门控。
 * 内置扩展权限随应用授予（声明即得）；外部扩展的授权 UX 阶段 4 定稿。
 */

import type { ExtensionManifest } from './manifest'

/** manifest 是否声明了某权限。 */
export function hasPermission(manifest: ExtensionManifest, perm: string): boolean {
  return manifest.permissions.includes(perm)
}

/** 断言权限；未声明时抛错（信息指明扩展与权限）。 */
export function requirePermission(manifest: ExtensionManifest, perm: string): void {
  if (!hasPermission(manifest, perm)) {
    throw new Error(`扩展 ${manifest.id} 未声明权限：${perm}`)
  }
}
