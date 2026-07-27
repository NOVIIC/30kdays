import type { StorageBackend } from './StorageBackend'

export async function exportZip(backend: StorageBackend): Promise<Blob> {
  return backend.exportZip()
}

export async function importZip(backend: StorageBackend, zip: Blob): Promise<void> {
  return backend.importZip(zip)
}
