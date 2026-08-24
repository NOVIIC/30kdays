/**
 * 存储 Worker 入口：在 Worker 内打开 OPFS 根目录并暴露 StorageBackend。
 * 主线程经 Comlink RPC 调用（见 index.ts）；I/O 全部发生在 Worker 内。
 */

import * as Comlink from 'comlink'
import { createOpfsStore } from './opfs-store'

/** 启动：解析 OPFS 根目录后暴露存储实现。 */
async function main(): Promise<void> {
  const root = await navigator.storage.getDirectory()
  Comlink.expose(createOpfsStore(root))
}

void main()
