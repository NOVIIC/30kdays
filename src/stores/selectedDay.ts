import { writable } from 'svelte/store'

export const selectedDay = writable<number | null>(null)
