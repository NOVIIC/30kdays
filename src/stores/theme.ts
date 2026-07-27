import { writable, get } from 'svelte/store'

export type ThemeSetting = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

const STORAGE_KEY = '30kdays-theme'

function readSetting(): ThemeSetting {
  if (typeof localStorage === 'undefined') return 'system'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export const themeSetting = writable<ThemeSetting>(readSetting())
export const effectiveTheme = writable<EffectiveTheme>('light')

let initialized = false

/** 应用启动时调用一次：应用初始主题并监听系统主题变化 */
export function initTheme(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const media = window.matchMedia('(prefers-color-scheme: dark)')

  const apply = () => {
    const setting = get(themeSetting)
    const eff: EffectiveTheme = setting === 'system' ? (media.matches ? 'dark' : 'light') : setting
    effectiveTheme.set(eff)
    document.documentElement.classList.toggle('dark', eff === 'dark')
  }

  themeSetting.subscribe((s) => {
    localStorage.setItem(STORAGE_KEY, s)
    apply()
  })
  media.addEventListener('change', apply)
  apply()
}

export function setTheme(s: ThemeSetting): void {
  themeSetting.set(s)
}
