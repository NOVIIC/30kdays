import type { StorageBackend, DayDoc } from './StorageBackend'
import type { LifeConfig } from '../domain/lifeConfig'
import { zipSync, unzipSync } from 'fflate'

export class OpfsBackend implements StorageBackend {
  private root: FileSystemDirectoryHandle | null = null

  async init(): Promise<void> {
    this.root = await navigator.storage.getDirectory()
  }

  async readConfig(): Promise<LifeConfig | null> {
    return this.readJSON<LifeConfig>('config.json')
  }

  async writeConfig(c: LifeConfig): Promise<void> {
    await this.writeJSON('config.json', c)
  }

  async readIndex(): Promise<Uint8Array | null> {
    try {
      const handle = await this.getFileHandle('index.bin')
      const file = await handle.getFile()
      return new Uint8Array(await file.arrayBuffer())
    } catch {
      return null
    }
  }

  async writeIndex(buf: Uint8Array): Promise<void> {
    await this.writeFile('index.bin', buf)
  }

  async readDay(n: number): Promise<DayDoc | null> {
    return this.readJSON<DayDoc>(`days/${n}.json`)
  }

  async writeDay(n: number, doc: DayDoc): Promise<void> {
    await this.writeJSON(`days/${n}.json`, doc)
  }

  async readMedia(n: number, id: string): Promise<Blob | null> {
    try {
      const handle = await this.getFileHandle(`media/${n}/${id}`)
      return await handle.getFile()
    } catch {
      return null
    }
  }

  async writeMedia(n: number, id: string, blob: Blob): Promise<void> {
    await this.writeFile(`media/${n}/${id}`, blob)
  }

  async deleteMedia(n: number, id: string): Promise<void> {
    try {
      const dir = await this.getDir(`media/${n}`)
      await dir.removeEntry(id)
    } catch {
      // ignore
    }
  }

  async readDoc<T>(name: string): Promise<T | null> {
    return this.readJSON<T>(name)
  }

  async writeDoc<T>(name: string, data: T): Promise<void> {
    await this.writeJSON(name, data)
  }

  async exportZip(): Promise<Blob> {
    const files: Record<string, Uint8Array> = {}
    await this.collectFiles('', files)
    const zipped = zipSync(files)
    return new Blob([zipped], { type: 'application/zip' })
  }

  async importZip(zip: Blob): Promise<void> {
    const data = new Uint8Array(await zip.arrayBuffer())
    const files = unzipSync(data)
    for (const [path, content] of Object.entries(files)) {
      const parent = path.substring(0, path.lastIndexOf('/'))
      if (parent) await this.ensureDir(parent)
      await this.writeFile(path, content)
    }
  }

  async estimate(): Promise<{ usage: number; quota: number }> {
    const est = await navigator.storage.estimate()
    return {
      usage: est.usage ?? 0,
      quota: est.quota ?? 0,
    }
  }

  private async collectFiles(dir: string, out: Record<string, Uint8Array>): Promise<void> {
    const handle = dir === '' ? this.root! : await this.getDir(dir)
    for await (const [name, entry] of handle.entries()) {
      const path = dir ? `${dir}/${name}` : name
      if (entry.kind === 'file') {
        const fh = entry as FileSystemFileHandle
        const file = await fh.getFile()
        out[path] = new Uint8Array(await file.arrayBuffer())
      } else if (entry.kind === 'directory') {
        await this.collectFiles(path, out)
      }
    }
  }

  private async getFileHandle(path: string): Promise<FileSystemFileHandle> {
    const parts = path.split('/')
    const name = parts.pop()!
    let dir = this.root!
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }
    return await dir.getFileHandle(name)
  }

  private async writeFile(path: string, content: string | Uint8Array | Blob): Promise<void> {
    const parts = path.split('/')
    const name = parts.pop()!
    let dir = this.root!
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(content as FileSystemWriteChunkType)
    await writable.close()
  }

  private async getDir(path: string): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/')
    let dir = this.root!
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part)
    }
    return dir
  }

  private async ensureDir(path: string): Promise<void> {
    const parts = path.split('/')
    let dir = this.root!
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true })
    }
  }

  private async readJSON<T>(path: string): Promise<T | null> {
    try {
      const handle = await this.getFileHandle(path)
      return JSON.parse(await (await handle.getFile()).text()) as T
    } catch {
      return null
    }
  }

  private async writeJSON<T>(path: string, data: T): Promise<void> {
    await this.writeFile(path, JSON.stringify(data))
  }
}
