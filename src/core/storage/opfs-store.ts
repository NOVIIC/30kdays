/**
 * OPFS 存储逻辑：以 FileSystemDirectoryHandle 为入参的 StorageBackend 实现。
 * 与 Worker 解耦以便单测（测试注入内存假句柄）；Worker 入口见 storage.worker.ts。
 * 文件布局见 ARCHITECTURE.md §6.2：
 * config.json / index.bin / days/<n>.json / media/<n>/<id>.webp|.thumb / <name>.json。
 */

import type { LifeConfig } from '../domain/life'
import type { DayDoc } from '../domain/day-doc'
import type { MediaKind, StorageBackend, StorageUsage } from './backend'

/** 判断异常是否为「文件/目录不存在」（OPFS 未命中时抛 NotFoundError）。 */
function isNotFound(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'NotFoundError'
}

/** 逐级取得子目录句柄；create 为 true 时缺失即创建。 */
async function dirAt(
  root: FileSystemDirectoryHandle,
  path: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = root
  for (const name of path) {
    dir = await dir.getDirectoryHandle(name, { create })
  }
  return dir
}

/** 读取文件内容；不存在返回 null。 */
async function readFile(dir: FileSystemDirectoryHandle, name: string): Promise<File | null> {
  try {
    const handle = await dir.getFileHandle(name)
    return await handle.getFile()
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

/** 写入文件内容（整体覆盖）。 */
async function writeFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  data: Blob | Uint8Array | string,
): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  // FileSystemWriteChunkType 要求 ArrayBuffer 后备；拷贝一份以兼容 ArrayBufferLike 的入参
  await writable.write(data instanceof Uint8Array ? new Uint8Array(data) : data)
  await writable.close()
}

/** 读取 JSON 文件并解析；不存在返回 null。 */
async function readJson(dir: FileSystemDirectoryHandle, name: string): Promise<unknown | null> {
  const file = await readFile(dir, name)
  if (file === null) return null
  return JSON.parse(await file.text())
}

/** 将值序列化为 JSON 写入文件。 */
async function writeJson(
  dir: FileSystemDirectoryHandle,
  name: string,
  value: unknown,
): Promise<void> {
  await writeFile(dir, name, JSON.stringify(value))
}

/** 媒体文件名：完整图为 <id>.webp，缩略图为 <id>.thumb。 */
function mediaFileName(id: string, kind: MediaKind): string {
  return kind === 'full' ? `${id}.webp` : `${id}.thumb`
}

/**
 * 基于 OPFS 根目录句柄创建 StorageBackend。
 * 每个方法按需解析子目录（days/、media/<n>/），写入时自动创建缺失目录。
 */
export function createOpfsStore(root: FileSystemDirectoryHandle): StorageBackend {
  return {
    async readConfig(): Promise<LifeConfig | null> {
      return (await readJson(root, 'config.json')) as LifeConfig | null
    },

    async writeConfig(config: LifeConfig): Promise<void> {
      await writeJson(root, 'config.json', config)
    },

    async readIndex(): Promise<Uint8Array | null> {
      const file = await readFile(root, 'index.bin')
      if (file === null) return null
      return new Uint8Array(await file.arrayBuffer())
    },

    async writeIndex(bytes: Uint8Array): Promise<void> {
      await writeFile(root, 'index.bin', bytes)
    },

    async readDayDoc(day: number): Promise<DayDoc | null> {
      const days = await dirAt(root, ['days'], false).catch((err: unknown) => {
        if (isNotFound(err)) return null
        throw err
      })
      if (days === null) return null
      return (await readJson(days, `${day}.json`)) as DayDoc | null
    },

    async writeDayDoc(day: number, doc: DayDoc): Promise<void> {
      const days = await dirAt(root, ['days'], true)
      await writeJson(days, `${day}.json`, doc)
    },

    async putMedia(day: number, id: string, full: Blob, thumb: Blob): Promise<void> {
      const dir = await dirAt(root, ['media', String(day)], true)
      await writeFile(dir, mediaFileName(id, 'full'), full)
      await writeFile(dir, mediaFileName(id, 'thumb'), thumb)
    },

    async getMedia(day: number, id: string, kind: MediaKind): Promise<Blob | null> {
      const dir = await dirAt(root, ['media', String(day)], false).catch((err: unknown) => {
        if (isNotFound(err)) return null
        throw err
      })
      if (dir === null) return null
      return await readFile(dir, mediaFileName(id, kind))
    },

    async deleteMedia(day: number, id: string): Promise<void> {
      const dir = await dirAt(root, ['media', String(day)], false).catch((err: unknown) => {
        if (isNotFound(err)) return null
        throw err
      })
      if (dir === null) return
      for (const kind of ['full', 'thumb'] as const) {
        await dir.removeEntry(mediaFileName(id, kind)).catch((err: unknown) => {
          if (!isNotFound(err)) throw err
        })
      }
    },

    async readDoc(name: string): Promise<unknown | null> {
      return await readJson(root, `${name}.json`)
    },

    async writeDoc(name: string, value: unknown): Promise<void> {
      await writeJson(root, `${name}.json`, value)
    },

    async estimateUsage(): Promise<StorageUsage> {
      const est = await navigator.storage.estimate()
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
    },
  }
}
