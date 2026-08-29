/**
 * 存储 Worker 入口：在 Worker 内打开 OPFS 根目录并暴露 StorageBackend。
 * 主线程经 Comlink RPC 调用（见 index.ts）；I/O 全部发生在 Worker 内。
 * expose 必须在模块求值期间同步执行（root 以 Promise 传入、惰性解析），
 * 否则主线程 wrap 后立即发来的 RPC 消息会在监听器挂载前被派发而丢失。
 */

import * as Comlink from 'comlink'
import { createOpfsStore } from './opfs-store'

Comlink.expose(createOpfsStore(navigator.storage.getDirectory()))
