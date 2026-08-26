/**
 * Host 接线：内置扩展注册表的主线程入口与扩展上下文缓存。
 * 扩展视图经 getExtensionContext(extId) 拿到 Host API（fs 按 manifest 权限门控）。
 */

import {
  builtinExtensions,
  createExtensionContext,
  type ContributedView,
  type ExtensionContext,
} from '../core/host'
import { getBackend } from './storage'

/** 全部内置扩展贡献的视图（当前平台子集），供导航与路由消费。 */
export const extensionViews: ContributedView[] = builtinExtensions.flatMap((ext) => ext.views)

const contexts = new Map<string, ExtensionContext>()

/** 获取扩展上下文（按 extId 缓存）；未注册的扩展抛错。 */
export function getExtensionContext(extId: string): ExtensionContext {
  let ctx = contexts.get(extId)
  if (ctx === undefined) {
    const ext = builtinExtensions.find((e) => e.manifest.id === extId)
    if (ext === undefined) throw new Error(`未注册的扩展：${extId}`)
    ctx = createExtensionContext(getBackend(), ext.manifest)
    contexts.set(extId, ctx)
  }
  return ctx
}
