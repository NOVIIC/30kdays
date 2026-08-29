/**
 * OPFS 存储逻辑：以 FileSystemDirectoryHandle 为入参的 StorageBackend 实现。
 * 与 Worker 解耦以便单测（测试注入内存假句柄）；Worker 入口见 storage.worker.ts。
 * 文件布局见 ARCHITECTURE.md §6.2：
 * config.json / index.bin / days/<n>.json / media/<n>/<id>.webp|.thumb / ext/<id>/…。
 */

import type { LifeConfig } from '../domain/life'
import type { DayDoc } from '../domain/day-doc'
import type { DirListing, MediaKind, StorageBackend, StoragePath, StorageUsage } from './backend'

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

/** 逐级解析目录路径；不存在（且不创建）时返回 null。 */
async function dirAtOrNull(
  root: FileSystemDirectoryHandle,
  path: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await dirAt(root, path, create)
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

/** 读取目录内文件内容；不存在返回 null。 */
async function readFileIn(dir: FileSystemDirectoryHandle, name: string): Promise<File | null> {
  try {
    const handle = await dir.getFileHandle(name)
    return await handle.getFile()
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

/** 写入目录内文件内容（整体覆盖）。 */
async function writeFileIn(
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
  const file = await readFileIn(dir, name)
  if (file === null) return null
  return JSON.parse(await file.text())
}

/** 将值序列化为 JSON 写入文件。 */
async function writeJson(
  dir: FileSystemDirectoryHandle,
  name: string,
  value: unknown,
): Promise<void> {
  await writeFileIn(dir, name, JSON.stringify(value))
}

/** 媒体文件名：完整图为 <id>.webp，缩略图为 <id>.thumb。 */
function mediaFileName(id: string, kind: MediaKind): string {
  return kind === 'full' ? `${id}.webp` : `${id}.thumb`
}

/** 将存储路径拆成目录段与末段名；路径为空（无末段）时抛错。 */
function splitPath(path: StoragePath): { dirs: string[]; name: string } {
  const name = path[path.length - 1]
  if (name === undefined) throw new Error('存储路径不能为空')
  return { dirs: path.slice(0, -1), name }
}

/** FileSystemDirectoryHandle.entries() 的最小类型声明（部分 TS lib 未内置）。 */
type DirWithEntries = {
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>
}

/**
 * 基于 OPFS 根目录句柄创建 StorageBackend。
 * 每个方法按需解析子目录（days/、media/<n>/、ext/<id>/…），写入时自动创建缺失目录。
 * 入参允许为 Promise：Worker 入口在模块求值期间同步暴露 RPC（避免消息在 expose 前
 * 派发给尚未挂载的监听器而丢失），root 在各方法内惰性 await，仅首次真正等待。
 */
export function createOpfsStore(
  root: FileSystemDirectoryHandle | Promise<FileSystemDirectoryHandle>,
): StorageBackend {
  const rootPromise = Promise.resolve(root)
  return {
    async readConfig(): Promise<LifeConfig | null> {
      return (await readJson(await rootPromise, 'config.json')) as LifeConfig | null
    },

    async writeConfig(config: LifeConfig): Promise<void> {
      await writeJson(await rootPromise, 'config.json', config)
    },

    async readIndex(): Promise<Uint8Array | null> {
      const file = await readFileIn(await rootPromise, 'index.bin')
      if (file === null) return null
      return new Uint8Array(await file.arrayBuffer())
    },

    async writeIndex(bytes: Uint8Array): Promise<void> {
      await writeFileIn(await rootPromise, 'index.bin', bytes)
    },

    async readDayDoc(day: number): Promise<DayDoc | null> {
      const days = await dirAtOrNull(await rootPromise, ['days'], false)
      if (days === null) return null
      return (await readJson(days, `${day}.json`)) as DayDoc | null
    },

    async writeDayDoc(day: number, doc: DayDoc): Promise<void> {
      const days = await dirAt(await rootPromise, ['days'], true)
      await writeJson(days, `${day}.json`, doc)
    },

    async putMedia(day: number, id: string, full: Blob, thumb: Blob): Promise<void> {
      const dir = await dirAt(await rootPromise, ['media', String(day)], true)
      await writeFileIn(dir, mediaFileName(id, 'full'), full)
      await writeFileIn(dir, mediaFileName(id, 'thumb'), thumb)
    },

    async getMedia(day: number, id: string, kind: MediaKind): Promise<Blob | null> {
      const dir = await dirAtOrNull(await rootPromise, ['media', String(day)], false)
      if (dir === null) return null
      return await readFileIn(dir, mediaFileName(id, kind))
    },

    async deleteMedia(day: number, id: string): Promise<void> {
      const dir = await dirAtOrNull(await rootPromise, ['media', String(day)], false)
      if (dir === null) return
      for (const kind of ['full', 'thumb'] as const) {
        await dir.removeEntry(mediaFileName(id, kind)).catch((err: unknown) => {
          if (!isNotFound(err)) throw err
        })
      }
    },

    async readFile(path: StoragePath): Promise<Uint8Array | null> {
      const { dirs, name } = splitPath(path)
      const dir = await dirAtOrNull(await rootPromise, dirs, false)
      if (dir === null) return null
      const file = await readFileIn(dir, name)
      if (file === null) return null
      return new Uint8Array(await file.arrayBuffer())
    },

    async writeFile(path: StoragePath, data: Uint8Array): Promise<void> {
      const { dirs, name } = splitPath(path)
      const dir = await dirAt(await rootPromise, dirs, true)
      await writeFileIn(dir, name, data)
    },

    async listDir(path: StoragePath): Promise<DirListing | null> {
      const dir = await dirAtOrNull(await rootPromise, path, false)
      if (dir === null) return null
      const listing: DirListing = { dirs: [], files: [] }
      for await (const [name, handle] of (dir as unknown as DirWithEntries).entries()) {
        if (handle.kind === 'directory') listing.dirs.push(name)
        else listing.files.push(name)
      }
      return listing
    },

    async removeEntry(path: StoragePath): Promise<void> {
      const { dirs, name } = splitPath(path)
      const dir = await dirAtOrNull(await rootPromise, dirs, false)
      if (dir === null) return
      await dir.removeEntry(name, { recursive: true }).catch((err: unknown) => {
        if (!isNotFound(err)) throw err
      })
    },

    async estimateUsage(): Promise<StorageUsage> {
      const est = await navigator.storage.estimate()
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
    },
  }
}
