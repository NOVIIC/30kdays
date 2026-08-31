/**
 * Tauri 桌面壳存储后端：经自定义 Rust 命令（src-tauri/src/storage.rs）读写本地数据目录。
 * 数据根目录为应用数据目录（Windows：%APPDATA%/<identifier>），文件布局与 OPFS 侧一致。
 *
 * IPC 约定（与 Rust 侧对应）：
 * - JSON 文档（config / DayDoc）序列化为字符串直通；
 * - 字节读取返回 ArrayBuffer，空字节流视为「不存在」（index.bin 恒含格式头，不会误伤）；
 * - index.bin 写入以原始字节为整个 invoke 载荷（application/octet-stream）；
 *   其余字节参数以 Uint8Array 传递，由 IPC 层自动转 JSON 数值数组。
 */

import { invoke } from '@tauri-apps/api/core'
import type { DayDoc } from '../domain/day-doc'
import type { LifeConfig } from '../domain/life'
import type { DirListing, MediaKind, StorageBackend, StoragePath, StorageUsage } from './backend'

/** 调用字节读取命令并应用「空字节流即不存在」约定。 */
async function readBytes(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const bytes = new Uint8Array(await invoke<ArrayBuffer>(cmd, args))
  return bytes.length === 0 ? null : bytes
}

/** 创建 Tauri 桌面壳存储后端（Rust 命令的薄封装，无本地状态）。 */
export function createTauriStore(): StorageBackend {
  return {
    async readConfig() {
      const json = await invoke<string | null>('storage_read_config')
      return json === null ? null : (JSON.parse(json) as LifeConfig)
    },
    writeConfig: (config) => invoke<void>('storage_write_config', { json: JSON.stringify(config) }),

    readIndex: () => readBytes('storage_read_index'),
    // 原始字节作为整个 invoke 载荷发送（对应 Rust 侧 InvokeBody::Raw）
    writeIndex: (bytes) => invoke<void>('storage_write_index', bytes),

    async readDayDoc(day) {
      const json = await invoke<string | null>('storage_read_day_doc', { day })
      return json === null ? null : (JSON.parse(json) as DayDoc)
    },
    writeDayDoc: (day, doc) =>
      invoke<void>('storage_write_day_doc', { day, json: JSON.stringify(doc) }),

    async putMedia(day, id, full, thumb) {
      await invoke<void>('storage_put_media', {
        day,
        id,
        full: new Uint8Array(await full.arrayBuffer()),
        thumb: new Uint8Array(await thumb.arrayBuffer()),
      })
    },
    async getMedia(day, id, kind: MediaKind) {
      const bytes = await readBytes('storage_get_media', { day, id, kind })
      return bytes === null ? null : new Blob([bytes])
    },
    deleteMedia: (day, id) => invoke<void>('storage_delete_media', { day, id }),

    readFile: (path: StoragePath) => readBytes('storage_read_file', { path }),
    writeFile: (path: StoragePath, data) => invoke<void>('storage_write_file', { path, data }),
    listDir: (path: StoragePath) => invoke<DirListing | null>('storage_list_dir', { path }),
    removeEntry: (path: StoragePath) => invoke<void>('storage_remove_entry', { path }),

    estimateUsage: () => invoke<StorageUsage>('storage_estimate_usage'),
  }
}
