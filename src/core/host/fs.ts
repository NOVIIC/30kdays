/**
 * 扩展文件 API：以扩展 id 划定的 ext/<id>/ 作用域文件门面。
 * 字节为原语（readFile / writeFile），JSON 为语法糖（readJson / writeJson）。
 * 所有相对路径先经 paths.ts 校验并拼上 ext/<ext-id>/ 前缀，
 * 再交给 StorageBackend；扩展无法触及其它扩展或核心的文件。
 *
 * 数据保留约定：停用或卸载扩展不删除 ext/<id>/ 数据，
 * 由用户在设置的存储管理中手动清理（见 ARCHITECTURE.md §6.2）。
 */

import type { DirListing, StorageBackend } from '../storage/backend'
import { resolveExtensionPath } from './paths'

/** 提供给扩展的作用域文件 API（host.fs.*）。路径均为扩展文件夹内的相对段数组。 */
export type HostFs = {
  /** 读取文件字节；不存在返回 null。 */
  readFile(path: string[]): Promise<Uint8Array | null>
  /** 写入文件字节（整体覆盖）；缺失的目录逐级创建。 */
  writeFile(path: string[], data: Uint8Array): Promise<void>
  /** 读取 JSON 文件并解析；不存在返回 null；内容非法 JSON 时抛错。 */
  readJson(path: string[]): Promise<unknown | null>
  /** 将值序列化为 JSON 写入文件。 */
  writeJson(path: string[], value: unknown): Promise<void>
  /** 列出目录内容；目录不存在返回 null。path 缺省时列出扩展文件夹根。 */
  listDir(path?: string[]): Promise<DirListing | null>
  /** 删除文件或目录（目录递归删除）；不存在不报错。 */
  remove(path: string[]): Promise<void>
}

/** 为指定扩展创建文件 API 门面；extId 即 manifest 的 id。 */
export function createHostFs(backend: StorageBackend, extId: string): HostFs {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  return {
    async readFile(path: string[]): Promise<Uint8Array | null> {
      return await backend.readFile(resolveExtensionPath(extId, path))
    },

    async writeFile(path: string[], data: Uint8Array): Promise<void> {
      await backend.writeFile(resolveExtensionPath(extId, path), data)
    },

    async readJson(path: string[]): Promise<unknown | null> {
      const bytes = await backend.readFile(resolveExtensionPath(extId, path))
      if (bytes === null) return null
      return JSON.parse(decoder.decode(bytes))
    },

    async writeJson(path: string[], value: unknown): Promise<void> {
      const bytes = encoder.encode(JSON.stringify(value))
      await backend.writeFile(resolveExtensionPath(extId, path), bytes)
    },

    async listDir(path: string[] = []): Promise<DirListing | null> {
      return await backend.listDir(resolveExtensionPath(extId, path, { allowEmpty: true }))
    },

    async remove(path: string[]): Promise<void> {
      await backend.removeEntry(resolveExtensionPath(extId, path))
    },
  }
}
