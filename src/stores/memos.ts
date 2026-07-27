import { writable, get } from 'svelte/store'
import { storageService } from '../lib/storageService'
import type { Memo } from '../domain/memo'

export const memos = writable<Memo[]>([])

async function persist(list: Memo[]): Promise<void> {
  memos.set(list)
  await storageService.saveMemos(list)
}

export async function loadMemos(): Promise<void> {
  memos.set(await storageService.loadMemos())
}

export async function addMemo(m: Memo): Promise<void> {
  await persist([m, ...get(memos)])
}

export async function updateMemo(m: Memo): Promise<void> {
  await persist(get(memos).map((x) => (x.id === m.id ? m : x)))
}

export async function removeMemo(id: string): Promise<void> {
  await persist(get(memos).filter((x) => x.id !== id))
}
