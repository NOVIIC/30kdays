/**
 * 主题状态：light / dark / system 三档，生效值落到 <html> 的 .dark 类。
 * 偏好持久化在 localStorage（客户端偏好，不进应用数据存储层）。
 * 同时把 <meta name="theme-color"> 同步为生效主题的背景色，
 * 让浏览器标签页与已安装 PWA 的标题栏跟随主题（含系统深色模式）。
 */

import { get, writable } from 'svelte/store'

/** 主题设置项。 */
export type ThemeSetting = 'light' | 'dark' | 'system'

/** 实际生效的主题。 */
export type EffectiveTheme = 'light' | 'dark'

const STORAGE_KEY = '30kdays-theme'

/** 各生效主题对应的 theme-color（与 app.css 的 --bg 一致）。 */
const THEME_COLORS: Record<EffectiveTheme, string> = {
  light: '#f6f2e9',
  dark: '#1c1a17',
}

/** 读取持久化的主题设置；非法值回退 system。 */
function readSetting(): ThemeSetting {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

/** 当前主题设置。 */
export const themeSetting = writable<ThemeSetting>(readSetting())

/** 当前生效主题（system 时按系统偏好解析）。 */
export const effectiveTheme = writable<EffectiveTheme>('light')

let initialized = false

/** 应用启动时调用一次：应用初始主题并监听系统主题变化。 */
export function initTheme(): void {
  if (initialized) return
  initialized = true
  const media = window.matchMedia('(prefers-color-scheme: dark)')

  const apply = () => {
    const setting = get(themeSetting)
    const eff: EffectiveTheme = setting === 'system' ? (media.matches ? 'dark' : 'light') : setting
    effectiveTheme.set(eff)
    document.documentElement.classList.toggle('dark', eff === 'dark')
    // 同步浏览器/PWA 窗口配色；已安装 PWA 的标题栏在下次启动时生效
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[eff])
  }

  themeSetting.subscribe((s) => {
    localStorage.setItem(STORAGE_KEY, s)
    apply()
  })
  media.addEventListener('change', apply)
  apply()
}

/** 设置主题。 */
export function setTheme(s: ThemeSetting): void {
  themeSetting.set(s)
}
