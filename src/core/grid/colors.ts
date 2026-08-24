/**
 * 网格配色：双主题 GridColors 与像素打包工具。
 * 浅色以纸张感为主线；GridColors 之后与 CSS 变量同源（主题系统落地时接入）。
 * packColor 打包为小端 ABGR，供总览模式 Uint32Array 直写 ImageData 使用。
 */

/** 网格配色表。today 兼具「总览填充」与「高清描边」两种用途。 */
export type GridColors = {
  /** 画布背景。 */
  background: string
  /** 未来日。 */
  future: string
  /** 过去日（无内容）。 */
  past: string
  /** 有文字的过去日。 */
  text: string
  /** 有图片的过去日。 */
  media: string
  /** 今天（总览填充 / 高清描边）。 */
  today: string
  /** 选中格描边。 */
  selected: string
}

/** 浅色主题：纸张感。 */
export const GRID_COLORS_LIGHT: GridColors = {
  background: '#f6f2e9',
  future: '#e6e0d2',
  past: '#c9c0ac',
  text: '#948a72',
  media: '#b0724a',
  today: '#c2611e',
  selected: '#3f6d8e',
}

/** 深色主题。 */
export const GRID_COLORS_DARK: GridColors = {
  background: '#1c1a17',
  future: '#2a2723',
  past: '#4a443b',
  text: '#7a7161',
  media: '#b0724a',
  today: '#d98a52',
  selected: '#7fa3bd',
}

/** 解析 #rrggbb 为 [r, g, b]；格式非法时抛错。 */
export function parseHexColor(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) throw new Error(`无效的颜色值：${hex}`)
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

/** [r, g, b] 打包为小端 ABGR（不透明），供 Uint32Array 直写 ImageData。 */
export function packColor([r, g, b]: [number, number, number]): number {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

/** 解析并打包 #rrggbb 为 ABGR 像素值。 */
export function packHexColor(hex: string): number {
  return packColor(parseHexColor(hex))
}
