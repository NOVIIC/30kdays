import type { LifeConfig } from '../domain/lifeConfig'

export type DayDoc = {
  text: string
  media: { id: string; name: string; w: number; h: number; type: string }[]
  updatedAt: number
}

export interface StorageBackend {
  init(): Promise<void>
  readConfig(): Promise<LifeConfig | null>
  writeConfig(c: LifeConfig): Promise<void>
  readIndex(): Promise<Uint8Array | null>
  writeIndex(buf: Uint8Array): Promise<void>
  readDay(n: number): Promise<DayDoc | null>
  writeDay(n: number, doc: DayDoc): Promise<void>
  readMedia(n: number, id: string): Promise<Blob | null>
  writeMedia(n: number, id: string, blob: Blob): Promise<void>
  deleteMedia(n: number, id: string): Promise<void>
  /** 通用 JSON 文档读写（用于 todos、memos 等全局数据） */
  readDoc<T>(name: string): Promise<T | null>
  writeDoc<T>(name: string, data: T): Promise<void>
  exportZip(): Promise<Blob>
  importZip(zip: Blob): Promise<void>
  estimate(): Promise<{ usage: number; quota: number }>
}
