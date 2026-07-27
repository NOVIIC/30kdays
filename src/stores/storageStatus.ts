import { writable } from 'svelte/store'

export type StorageStatus = {
  usage: number
  quota: number
}

export const storageStatus = writable<StorageStatus>({ usage: 0, quota: 0 })
