/**
 * 存储层入口：StorageBackend 工厂与壳探测。
 * Tauri 桌面壳经 Rust 命令读写本地目录（tauri-store.ts）；
 * 浏览器（PWA）用 OPFS Worker（Comlink RPC 代理，storage.worker.ts）。
 */

import * as Comlink from 'comlink'
import type { StorageBackend } from './backend'
import { createTauriStore } from './tauri-store'

export type { DirListing, MediaKind, StorageBackend, StoragePath, StorageUsage } from './backend'

/** 是否运行在 Tauri 桌面壳 webview 内（Tauri 注入 __TAURI_INTERNALS__ 全局）。 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * 创建存储后端：Tauri 壳返回 Rust 命令实现；浏览器启动存储 Worker 并返回 Comlink 代理。
 * 代理方法与真实实现同为异步，调用方无感知。
 */
export function createStorageBackend(): StorageBackend {
  if (isTauri()) return createTauriStore()
  const worker = new Worker(new URL('./storage.worker.ts', import.meta.url), {
    type: 'module',
  })
  return Comlink.wrap<StorageBackend>(worker)
}
