import * as Comlink from 'comlink'
import { OpfsBackend } from './opfsBackend'
import type { LifeConfig } from '../domain/lifeConfig'

const backend = new OpfsBackend()

const api = {
  init: () => backend.init(),
  readConfig: () => backend.readConfig(),
  writeConfig: (c: LifeConfig) => backend.writeConfig(c),
  readIndex: () => backend.readIndex(),
  writeIndex: (buf: Uint8Array) => backend.writeIndex(buf),
  readDay: (n: number) => backend.readDay(n),
  writeDay: (n: number, doc: Parameters<typeof backend.writeDay>[1]) =>
    backend.writeDay(n, doc),
  readMedia: (n: number, id: string) => backend.readMedia(n, id),
  writeMedia: (n: number, id: string, blob: Blob) =>
    backend.writeMedia(n, id, blob),
  deleteMedia: (n: number, id: string) => backend.deleteMedia(n, id),
  exportZip: () => backend.exportZip(),
  importZip: (zip: Blob) => backend.importZip(zip),
  estimate: () => backend.estimate(),
}

Comlink.expose(api)

export type StorageWorker = typeof api
