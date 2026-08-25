/**
 * 路由状态：hash 路由（#calendar / #settings …），视图 id 为字符串，
 * 后续扩展的 views 贡献点也并入同一命名空间。
 * 日记深链走 query 参数 ?d=<index>（见 ARCHITECTURE §11）：
 * 打开日记 pushState 叠加参数，history 返回（popstate）即关闭。
 */

import { writable } from 'svelte/store'

/** 解析 location.hash 为视图 id；空 hash 落到日历；非浏览器环境（单测）返回默认视图。 */
function parseView(): string {
  if (typeof window === 'undefined') return 'calendar'
  return window.location.hash.slice(1) || 'calendar'
}

/** 解析 location.search 中的日记深链 ?d=<index>；无参数、非法值或非浏览器环境返回 null。 */
function parseOpenDay(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('d')
  if (raw === null) return null
  const day = Number.parseInt(raw, 10)
  return Number.isInteger(day) && day >= 0 ? day : null
}

/** 当前视图 id。 */
export const view = writable<string>(parseView())

/** 当前经深链打开的日记日索引；未打开为 null。 */
export const openDay = writable<number | null>(parseOpenDay())

/** 当前 ?d 状态是否由本应用 pushState 产生（决定关闭时能否 history.back()）。 */
let pushedByApp = false

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => view.set(parseView()))
  window.addEventListener('popstate', () => {
    openDay.set(parseOpenDay())
    pushedByApp = false
  })
}

/** 跳转到指定视图。 */
export function navigate(v: string): void {
  if (typeof window === 'undefined') return
  window.location.hash = v
}

/** 打开某天的日记深链：pushState 叠加 ?d=<index>（hash 视图保持不变）。 */
export function navigateToDay(day: number): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('d', String(day))
  window.history.pushState(null, '', url)
  pushedByApp = true
  openDay.set(day)
}

/**
 * 关闭日记深链：
 * 本应用 push 的状态用 history.back() 回退（popstate 负责清 openDay）；
 * 直接经深链进入的（无可回退状态）则 pushState 移除参数，
 * 此时浏览器「返回」会重新打开该日记，符合深链语义。
 */
export function closeDay(): void {
  if (typeof window === 'undefined') return
  if (pushedByApp) {
    window.history.back()
    return
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('d')
  window.history.pushState(null, '', url)
  openDay.set(null)
}
