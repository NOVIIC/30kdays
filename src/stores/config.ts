import { writable } from 'svelte/store'
import type { LifeConfig } from '../domain/lifeConfig'

export const config = writable<LifeConfig | null>(null)
