/**
 * Canvas 网格渲染器。
 * 总览（屏幕上格边长 < OVERVIEW_CELL_PX）：一格一像素写入离屏缓存（Uint32Array 直写），
 * 平移缩放只贴图；单格脏用 markDirty 补一像素。
 * 高清（≥ OVERVIEW_CELL_PX）：只画视口内的格子，圆角填充，今天与选中格描边。
 * DPR 封顶 MAX_DPR。
 */

import { FLAG_MEDIA, FLAG_TEXT } from '../domain/day-index'
import { createCamera, worldToScreen, type Camera } from './camera'
import { mixPacked, packHexColor, toHexColor, unpackColor, type GridColors } from './colors'
import type { GridLayout } from './layout'
import type { DayOverlay } from './overlay'

/** 渲染器内部持有的覆盖：tint 颜色已打包（总览直写像素用），dot 保留 hex（高清 fillStyle 用）。 */
type PackedOverlay = {
  tints: { color: number; intensity: number }[]
  dots: string[]
}

/** hex 底色混入打包的染色，返回 hex（高清填充用）。 */
function mixHexWithPacked(baseHex: string, tintPacked: number, intensity: number): string {
  return toHexColor(unpackColor(mixPacked(packHexColor(baseHex), tintPacked, intensity)))
}

/** 总览/高清分界：屏幕上的格边长（像素）。 */
export const OVERVIEW_CELL_PX = 12

/** DPR 上限。 */
export const MAX_DPR = 2

/** 网格渲染器：持有画布与总览缓存，由调用方驱动 render()。 */
export class GridRenderer {
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  private cssW = 0
  private cssH = 0

  private layout: GridLayout | null = null
  private dayIndex: Uint8Array = new Uint8Array(0)
  private today = -1
  private camera: Camera = createCamera()
  private selected: number | null = null

  private colors: GridColors
  private packed = { future: 0, past: 0, text: 0, media: 0, today: 0 }

  /** 扩展覆盖层（gridOverlays 派发点产物）：日索引 → 物化覆盖。 */
  private overlays: ReadonlyMap<number, PackedOverlay> = new Map()

  /** 总览离屏缓存：宽 cols、高 rows，一格一像素。 */
  private cache: HTMLCanvasElement | null = null
  private cacheCtx: CanvasRenderingContext2D | null = null
  private cacheImage: ImageData | null = null
  private cachePixels: Uint32Array | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    colors: GridColors,
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 2D 渲染上下文')
    this.ctx = ctx
    this.colors = colors
    this.packColors()
  }

  /** 更换配色并重打包像素。 */
  setColors(colors: GridColors): void {
    this.colors = colors
    this.packColors()
    this.rebuildCache()
  }

  /** 设置布局与日索引数据；today 为今天的日索引（可为负，表示尚未出生）。 */
  setData(layout: GridLayout, dayIndex: Uint8Array, today: number): void {
    this.layout = layout
    this.dayIndex = dayIndex
    this.today = today
    this.rebuildCache()
  }

  /** 更新相机。 */
  setCamera(camera: Camera): void {
    this.camera = camera
  }

  /** 更新选中格（null 清除）。 */
  setSelected(index: number | null): void {
    this.selected = index
  }

  /** 收录覆盖层（整表替换）；tint 颜色在此打包，热路径不再解析字符串。 */
  setOverlays(overlays: ReadonlyMap<number, DayOverlay>): void {
    const packed = new Map<number, PackedOverlay>()
    for (const [day, overlay] of overlays) {
      packed.set(day, {
        tints: overlay.tints.map((t) => ({ color: packHexColor(t.color), intensity: t.intensity })),
        dots: overlay.dots,
      })
    }
    this.overlays = packed
    this.rebuildCache()
  }

  /** 视口尺寸（CSS 像素）变化时调用，按 DPR 调整画布分辨率。 */
  resize(cssW: number, cssH: number): void {
    this.cssW = cssW
    this.cssH = cssH
    this.dpr = Math.min(MAX_DPR, globalThis.devicePixelRatio || 1)
    this.canvas.width = Math.round(cssW * this.dpr)
    this.canvas.height = Math.round(cssH * this.dpr)
  }

  /** 总览模式下补画单格（日索引标志变化后调用）。 */
  markDirty(i: number): void {
    if (!this.layout || !this.cacheCtx || !this.cacheImage || !this.cachePixels) return
    if (i < 0 || i >= this.layout.total) return
    const x = i % this.layout.cols
    const y = Math.floor(i / this.layout.cols)
    this.cachePixels[y * this.layout.cols + x] = this.cellPixel(i)
    this.cacheCtx.putImageData(this.cacheImage, 0, 0, x, y, 1, 1)
  }

  /** 渲染一帧。 */
  render(): void {
    const { ctx, layout } = this
    if (!layout) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.fillStyle = this.colors.background
    ctx.fillRect(0, 0, this.cssW, this.cssH)
    if (layout.cell * this.camera.scale < OVERVIEW_CELL_PX) {
      this.renderOverview()
    } else {
      this.renderDetail()
    }
  }

  /** 释放离屏缓存。 */
  destroy(): void {
    this.cache = null
    this.cacheCtx = null
    this.cacheImage = null
    this.cachePixels = null
  }

  /** 预打包各状态像素值。 */
  private packColors(): void {
    this.packed = {
      future: packHexColor(this.colors.future),
      past: packHexColor(this.colors.past),
      text: packHexColor(this.colors.text),
      media: packHexColor(this.colors.media),
      today: packHexColor(this.colors.today),
    }
  }

  /** 日索引 → 总览像素值；基础色按 今天 > 图片 > 文字 > 过去/未来 取定后依序混入覆盖染色。 */
  private cellPixel(i: number): number {
    let base: number
    if (i === this.today) {
      base = this.packed.today
    } else {
      const flags = this.dayIndex[i]
      if (flags & FLAG_MEDIA) base = this.packed.media
      else if (flags & FLAG_TEXT) base = this.packed.text
      else base = i < this.today ? this.packed.past : this.packed.future
    }
    const overlay = this.overlays.get(i)
    if (overlay === undefined) return base
    for (const tint of overlay.tints) base = mixPacked(base, tint.color, tint.intensity)
    return base
  }

  /** 日索引 → 高清填充色（今天不在此特判，由描边表现）；依序混入覆盖染色。 */
  private cellFill(i: number): string {
    const flags = this.dayIndex[i]
    let base: string
    if (flags & FLAG_MEDIA) base = this.colors.media
    else if (flags & FLAG_TEXT) base = this.colors.text
    else base = i < this.today ? this.colors.past : this.colors.future
    const overlay = this.overlays.get(i)
    if (overlay === undefined) return base
    for (const tint of overlay.tints) base = mixHexWithPacked(base, tint.color, tint.intensity)
    return base
  }

  /** 重建总览缓存（布局或配色变化后）。 */
  private rebuildCache(): void {
    if (!this.layout) return
    const { cols, rows, total } = this.layout
    if (!this.cache) {
      this.cache = document.createElement('canvas')
    }
    this.cache.width = cols
    this.cache.height = rows
    this.cacheCtx = this.cache.getContext('2d')
    if (!this.cacheCtx) throw new Error('无法创建离屏渲染上下文')
    this.cacheImage = this.cacheCtx.createImageData(cols, rows)
    this.cachePixels = new Uint32Array(this.cacheImage.data.buffer)
    for (let i = 0; i < total; i++) {
      this.cachePixels[i] = this.cellPixel(i)
    }
    // 末行补位像素与背景同色，避免贴图时露出底色
    for (let i = total; i < cols * rows; i++) {
      this.cachePixels[i] = packHexColor(this.colors.background)
    }
    this.cacheCtx.putImageData(this.cacheImage, 0, 0)
  }

  /** 总览：整网贴图。 */
  private renderOverview(): void {
    const layout = this.layout
    if (!layout || !this.cache) return
    const tl = worldToScreen(this.camera, { x: 0, y: 0 })
    const { ctx } = this
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      this.cache,
      tl.x,
      tl.y,
      layout.width * this.camera.scale,
      layout.height * this.camera.scale,
    )
    // 选中格在总览下以描边标记
    if (this.selected !== null && this.selected < layout.total) {
      const col = this.selected % layout.cols
      const row = Math.floor(this.selected / layout.cols)
      const s = this.camera.scale * layout.cell
      ctx.strokeStyle = this.colors.selected
      ctx.lineWidth = Math.max(1, s * 0.15)
      ctx.strokeRect(tl.x + col * s, tl.y + row * s, s, s)
    }
  }

  /** 高清：只画视口内格子，圆角填充 + 今天/选中描边。 */
  private renderDetail(): void {
    const layout = this.layout
    if (!layout) return
    const { ctx, camera } = this
    const s = layout.cell * camera.scale // 屏幕上格边长
    const tl = worldToScreen(camera, { x: 0, y: 0 })
    const colStart = Math.max(0, Math.floor(-tl.x / s))
    const rowStart = Math.max(0, Math.floor(-tl.y / s))
    const colEnd = Math.min(layout.cols - 1, Math.ceil((this.cssW - tl.x) / s))
    const rowEnd = Math.min(layout.rows - 1, Math.ceil((this.cssH - tl.y) / s))

    const pad = Math.max(1, s * 0.08)
    const size = s - pad * 2
    const r = Math.min(6, size * 0.3)

    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const i = row * layout.cols + col
        if (i >= layout.total) continue
        const x = tl.x + col * s + pad
        const y = tl.y + row * s + pad
        ctx.fillStyle = this.cellFill(i)
        ctx.beginPath()
        ctx.roundRect(x, y, size, size, r)
        ctx.fill()
        if (i === this.today || i === this.selected) {
          ctx.strokeStyle = i === this.today ? this.colors.today : this.colors.selected
          ctx.lineWidth = Math.max(1.5, s * 0.06)
          ctx.stroke()
        }
        // 覆盖层圆点：右下角自右向左横排
        const overlay = this.overlays.get(i)
        if (overlay !== undefined && overlay.dots.length > 0) {
          const dr = Math.max(1.5, size * 0.12)
          const cy = y + size - dr * 1.4
          overlay.dots.forEach((color, k) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(x + size - dr * 1.4 - k * dr * 2.6, cy, dr, 0, Math.PI * 2)
            ctx.fill()
          })
        }
      }
    }
  }
}
