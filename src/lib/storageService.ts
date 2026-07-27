import { OpfsBackend } from '../storage/opfsBackend'
import { FsAccessBackend } from '../storage/fsAccessBackend'
import type { StorageBackend, DayDoc } from '../storage/StorageBackend'
import type { LifeConfig } from '../domain/lifeConfig'
import { totalDays } from '../domain/lifeConfig'
import { createDayIndex, setFlags, getFlags } from '../domain/dayIndex'

class StorageService {
  backend: StorageBackend | null = null
  indexBuffer: Uint8Array | null = null
  totalDays = 0

  async init(): Promise<LifeConfig | null> {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        this.backend = new FsAccessBackend()
        await this.backend.init()
      } catch {
        this.backend = null
      }
    }
    if (!this.backend) {
      this.backend = new OpfsBackend()
      await this.backend.init()
    }

    const cfg = await this.backend.readConfig()
    if (cfg) {
      this.totalDays = totalDays(cfg)
      const idx = await this.backend.readIndex()
      this.indexBuffer = idx ?? createDayIndex(this.totalDays)
    }
    return cfg
  }

  async saveConfig(cfg: LifeConfig): Promise<void> {
    if (!this.backend) return
    this.totalDays = totalDays(cfg)
    this.indexBuffer = createDayIndex(this.totalDays)
    await this.backend.writeConfig(cfg)
    await this.backend.writeIndex(this.indexBuffer)
  }

  async saveDay(index: number, doc: DayDoc): Promise<void> {
    if (!this.backend || !this.indexBuffer) return
    let flags = 0
    if (doc.text) flags |= 1
    if (doc.media.length > 0) flags |= 2
    setFlags(this.indexBuffer, index, flags)
    await Promise.all([
      this.backend.writeDay(index, doc),
      this.backend.writeIndex(this.indexBuffer),
    ])
  }

  async saveDayIndex(index: number, flags: number): Promise<void> {
    if (!this.backend || !this.indexBuffer) return
    setFlags(this.indexBuffer, index, flags)
    await this.backend.writeIndex(this.indexBuffer)
  }

  async readDay(index: number): Promise<DayDoc | null> {
    if (!this.backend) return null
    return this.backend.readDay(index)
  }

  getDayFlags(index: number): number {
    if (!this.indexBuffer) return 0
    return getFlags(this.indexBuffer, index)
  }

  async readMedia(dayIndex: number, id: string): Promise<Blob | null> {
    if (!this.backend) return null
    return this.backend.readMedia(dayIndex, id)
  }

  async writeMedia(dayIndex: number, id: string, blob: Blob): Promise<void> {
    if (!this.backend) return
    await this.backend.writeMedia(dayIndex, id, blob)
  }

  async deleteMedia(dayIndex: number, id: string): Promise<void> {
    if (!this.backend) return
    await this.backend.deleteMedia(dayIndex, id)
  }

  async exportZip(): Promise<Blob | null> {
    if (!this.backend) return null
    return this.backend.exportZip()
  }

  async importZip(zip: Blob): Promise<void> {
    if (!this.backend) return
    await this.backend.importZip(zip)
    // Reload index after import
    const idx = await this.backend.readIndex()
    if (idx) {
      this.indexBuffer = idx
      this.totalDays = idx.length
    }
  }

  async estimate(): Promise<{ usage: number; quota: number }> {
    if (!this.backend) return { usage: 0, quota: 0 }
    return this.backend.estimate()
  }
}

export const storageService = new StorageService()
