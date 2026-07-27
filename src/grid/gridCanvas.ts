import { computeLayout, type Layout } from './layout'
import { createCamera, zoomAt, screenToWorld, type Camera } from './camera'
import { indexFromPoint } from './hitTest'
import { createOverviewImageData } from './renderOverview'
import { renderDetail } from './renderDetail'
import { setupInput } from './input'
import { dayFill, lightGridColors, type GridColors } from './palette'
import { FLAG_HAS_TEXT, FLAG_HAS_IMAGE, FLAG_HAS_TODO } from '../domain/dayIndex'

export interface GridCanvasOptions {
  canvas: HTMLCanvasElement
  totalDays: number
  todayIndex: number
  getDayFlags: (index: number) => number
  onCellClick: (index: number) => void
  colors?: GridColors
}

export interface GridCanvasController {
  markDirty(): void
  setColors(colors: GridColors): void
  resetView(): void
  destroy(): void
}

const MAX_CELL_PX = 80
const OVERVIEW_THRESHOLD = 12

export function createGridCanvas(opts: GridCanvasOptions): GridCanvasController {
  let camera: Camera = createCamera()
  let layout: Layout | null = null
  let overviewBitmap: ImageData | null = null
  let bitmapCanvas: HTMLCanvasElement | null = null
  let dirty = true
  let rafId = 0
  let colors: GridColors = opts.colors ?? lightGridColors
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  function rebuildLayout(): boolean {
    const rect = opts.canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    const newLayout = computeLayout(opts.totalDays, rect.width, rect.height)
    if (
      layout &&
      layout.cols === newLayout.cols &&
      layout.rows === newLayout.rows &&
      layout.cellSize === newLayout.cellSize
    ) {
      return false
    }
    // Preserve focus on same world center
    if (layout) {
      const cx = rect.width / 2
      const cy = rect.height / 2
      const prevWorld = screenToWorld(camera, cx, cy)
      camera.scale = 1
      camera.offsetX = prevWorld.x - cx
      camera.offsetY = prevWorld.y - cy
    } else {
      camera = createCamera()
    }
    layout = newLayout
    overviewBitmap = null
    bitmapCanvas = null
    dirty = true
    return true
  }

  function resizeCanvas() {
    const rect = opts.canvas.getBoundingClientRect()
    opts.canvas.width = rect.width * dpr
    opts.canvas.height = rect.height * dpr
  }

  function buildOverviewBitmap() {
    if (!layout || layout.totalDays <= 0) return
    const fills: string[] = new Array(opts.totalDays)
    for (let i = 0; i < opts.totalDays; i++) {
      const flags = opts.getDayFlags(i)
      fills[i] = dayFill(colors, {
        isPast: i < opts.todayIndex,
        isToday: i === opts.todayIndex,
        hasContent: (flags & (FLAG_HAS_TEXT | FLAG_HAS_IMAGE)) !== 0,
      })
    }
    overviewBitmap = createOverviewImageData(layout.cols, layout.rows, opts.totalDays, fills)
  }

  function render() {
    if (!layout || layout.totalDays <= 0) return
    const ctx = opts.canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.scale(dpr, dpr)

    const rect = opts.canvas.getBoundingClientRect()
    const vw = rect.width
    const vh = rect.height

    ctx.clearRect(0, 0, vw, vh)
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, vw, vh)

    const cellScreenSize = layout.cellSize * camera.scale

    if (cellScreenSize < OVERVIEW_THRESHOLD) {
      if (!overviewBitmap) buildOverviewBitmap()
      if (overviewBitmap) {
        if (!bitmapCanvas) {
          bitmapCanvas = document.createElement('canvas')
          bitmapCanvas.width = layout.cols
          bitmapCanvas.height = layout.rows
          const bmpCtx = bitmapCanvas.getContext('2d')!
          bmpCtx.putImageData(overviewBitmap, 0, 0)
        }
        const x = -camera.offsetX * camera.scale
        const y = -camera.offsetY * camera.scale
        const w = layout.cols * layout.cellSize * camera.scale
        const h = layout.rows * layout.cellSize * camera.scale
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(bitmapCanvas, x, y, w, h)

        // 叠加网格线，让"每一天"在全景下依然可辨
        if (cellScreenSize >= 4) {
          ctx.strokeStyle = colors.bg
          ctx.lineWidth = 1
          ctx.beginPath()
          for (let c = 1; c < layout.cols; c++) {
            const lx = x + c * cellScreenSize
            ctx.moveTo(lx, y)
            ctx.lineTo(lx, y + h)
          }
          for (let r = 1; r < layout.rows; r++) {
            const ly = y + r * cellScreenSize
            ctx.moveTo(x, ly)
            ctx.lineTo(x + w, ly)
          }
          ctx.stroke()
        }

        // "今天"标记：比单格略大，全景下也清晰可见
        const tCol = opts.todayIndex % layout.cols
        const tRow = Math.floor(opts.todayIndex / layout.cols)
        const tx = x + tCol * cellScreenSize
        const ty = y + tRow * cellScreenSize
        const pad = Math.max(1, cellScreenSize * 0.35)
        ctx.fillStyle = colors.accent
        ctx.fillRect(tx - pad, ty - pad, cellScreenSize + pad * 2, cellScreenSize + pad * 2)
      }
    } else {
      if (overviewBitmap || bitmapCanvas) {
        overviewBitmap = null
        bitmapCanvas = null
      }
      renderDetail(ctx, camera, layout, vw, vh, colors, (i: number) => {
        const flags = opts.getDayFlags(i)
        return {
          isPast: i < opts.todayIndex,
          isToday: i === opts.todayIndex,
          hasContent: (flags & (FLAG_HAS_TEXT | FLAG_HAS_IMAGE)) !== 0,
          hasTodo: !!(flags & FLAG_HAS_TODO),
        }
      })
    }

    ctx.restore()
  }

  function scheduleRender() {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      if (dirty) {
        dirty = false
        render()
      }
    })
  }

  function handleZoom(factor: number, sx: number, sy: number) {
    const newScale = camera.scale * factor
    const minScale = 1
    if (!layout) return
    const maxScale = MAX_CELL_PX / layout.cellSize
    const clamped = Math.max(minScale, Math.min(maxScale, newScale))
    if (clamped === camera.scale && clamped !== newScale) return
    const clampedFactor = clamped / camera.scale
    camera = zoomAt(camera, sx, sy, clampedFactor)
    dirty = true
    scheduleRender()
  }

  function handlePan(dx: number, dy: number) {
    camera.offsetX -= dx / camera.scale
    camera.offsetY -= dy / camera.scale
    dirty = true
    scheduleRender()
  }

  function handleClick(sx: number, sy: number) {
    if (!layout) return
    const world = screenToWorld(camera, sx, sy)
    const idx = indexFromPoint(layout, world.x, world.y)
    if (idx !== null) {
      opts.onCellClick(idx)
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    const changed = rebuildLayout()
    if (changed) {
      resizeCanvas()
    }
    dirty = true
    scheduleRender()
  })

  const inputCleanup = setupInput(opts.canvas, () => camera, {
    onZoom: handleZoom,
    onPan: handlePan,
    onClick: handleClick,
  })

  resizeObserver.observe(opts.canvas.parentElement ?? opts.canvas)
  rebuildLayout()
  resizeCanvas()
  dirty = true
  scheduleRender()

  return {
    markDirty() {
      overviewBitmap = null
      bitmapCanvas = null
      dirty = true
      scheduleRender()
    },
    setColors(next: GridColors) {
      colors = next
      overviewBitmap = null
      bitmapCanvas = null
      dirty = true
      scheduleRender()
    },
    resetView() {
      camera = createCamera()
      dirty = true
      scheduleRender()
    },
    destroy() {
      resizeObserver.disconnect()
      inputCleanup()
      if (rafId) cancelAnimationFrame(rafId)
    },
  }
}
