/**
 * StorageBackend：存储后端统一接口。
 * 上层与扩展只依赖本接口；PWA 侧由 OPFS Worker 实现（见 index.ts），
 * 桌面壳（Tauri）经自定义 Rust 命令读写本地数据目录（见 tauri-store.ts）。
 * 所有方法均为异步，以便主线程经 Comlink RPC 调用 Worker 内的真实实现。
 */

import type { LifeConfig } from '../domain/life'
import type { DayDoc } from '../domain/day-doc'

/** 存储用量估计（字节），取自 navigator.storage.estimate()。 */
export type StorageUsage = {
  /** 已用字节数（整个源，非本应用独占计量）。 */
  usage: number
  /** 配额字节数。 */
  quota: number
}

/** 媒体读取的档位：完整图或缩略图。 */
export type MediaKind = 'full' | 'thumb'

/**
 * 存储相对路径：段数组（如 ['ext', 'memo', 'memos.json']）。
 * 各段的安全性由调用方（Extension Host）校验保证，backend 信任并逐段解析；
 * 段内不允许出现 '/'、'\\'、'.'、'..'（Host 侧校验规则见 core/host）。
 */
export type StoragePath = string[]

/** 目录清单：子目录名与文件名列表。 */
export type DirListing = {
  /** 子目录名。 */
  dirs: string[]
  /** 文件名。 */
  files: string[]
}

/**
 * 存储后端统一接口。
 * 文件布局（两壳一致，见 ARCHITECTURE.md §6.2）：
 * config.json / index.bin / days/<n>.json / media/<n>/<id>.webp|.thumb / ext/<id>/…。
 */
export interface StorageBackend {
  /** 读取人生配置；未初始化（首次使用）返回 null。 */
  readConfig(): Promise<LifeConfig | null>
  /** 写入人生配置。 */
  writeConfig(config: LifeConfig): Promise<void>

  /** 读取 index.bin 原始字节（含格式版本头）；不存在返回 null。编解码见 domain/day-index。 */
  readIndex(): Promise<Uint8Array | null>
  /** 写入 index.bin 原始字节（含格式版本头）。 */
  writeIndex(bytes: Uint8Array): Promise<void>

  /** 读取第 day 天的日记文档；不存在返回 null。 */
  readDayDoc(day: number): Promise<DayDoc | null>
  /** 写入第 day 天的日记文档（days/<day>.json）。 */
  writeDayDoc(day: number, doc: DayDoc): Promise<void>

  /** 写入某天的媒体附件：完整图 media/<day>/<id>.webp 与缩略图 .thumb。 */
  putMedia(day: number, id: string, full: Blob, thumb: Blob): Promise<void>
  /** 读取某天的媒体附件；不存在返回 null。 */
  getMedia(day: number, id: string, kind: MediaKind): Promise<Blob | null>
  /** 删除某天的媒体附件（完整图与缩略图一并删除）。 */
  deleteMedia(day: number, id: string): Promise<void>

  /**
   * 读取文件字节；不存在返回 null。
   * 主要供扩展文档使用（经 Host 解析为 ext/<id>/… 路径）。
   */
  readFile(path: StoragePath): Promise<Uint8Array | null>
  /** 写入文件字节（整体覆盖）；缺失的目录逐级创建。 */
  writeFile(path: StoragePath, data: Uint8Array): Promise<void>
  /** 列出目录内容；目录不存在返回 null。path 为空数组时列出根目录。 */
  listDir(path: StoragePath): Promise<DirListing | null>
  /** 删除文件或目录（目录递归删除）；不存在不报错。 */
  removeEntry(path: StoragePath): Promise<void>

  /** 估计存储用量（整个源的 usage/quota）。 */
  estimateUsage(): Promise<StorageUsage>
}
