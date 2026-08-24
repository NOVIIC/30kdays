/**
 * 存储层入口：创建 StorageBackend 的工厂。
 * PWA 侧实现为 OPFS Worker（Comlink RPC 代理）；桌面壳后期提供本地目录实现。
 */

import * as Comlink from 'comlink'
import type { StorageBackend } from './backend'

export type { MediaKind, StorageBackend, StorageUsage } from './backend'

/**
 * 创建存储后端：启动存储 Worker 并返回 Comlink 代理。
 * 代理方法与真实实现同为异步，调用方无感知。
 */
export function createStorageBackend(): StorageBackend {
  const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), {
    type: 'module',
  })
  return Comlink.wrap<StorageBackend>(worker)
}
