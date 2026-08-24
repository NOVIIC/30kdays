/**
 * 路由状态：hash 路由（#calendar / #settings …），视图 id 为字符串，
 * 后续扩展的 views 贡献点也并入同一命名空间。
 */

import { writable } from 'svelte/store'

/** 解析 location.hash 为视图 id；空 hash 落到日历。 */
function parseView(): string {
  return window.location.hash.slice(1) || 'calendar'
}

/** 当前视图 id。 */
export const view = writable<string>(parseView())

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => view.set(parseView()))
}

/** 跳转到指定视图。 */
export function navigate(v: string): void {
  window.location.hash = v
}
