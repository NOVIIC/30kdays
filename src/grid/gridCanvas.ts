import { computeLayout, type Layout } from './layout'
import { createCamera, zoomAt, screenToWorld, type Camera } from './camera'
import { indexFromPoint } from './hitTest'
import { createOverviewImageData } from './renderOverview'
import { renderDetail } from './renderDetail'
import { setupInput } from './input'

export interface GridCanvasOptions {
  canvas: HTMLCanvasElement
  totalDays: number
  todayIndex: number
  getDayFlags: (index: number) => number
  onCellClick: (index: number) => void
}

export interface GridCanvasController {
  markDirty(): void
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
    const colors: string[] = new Array(opts.totalDays)
    for (let i = 0; i < opts.totalDays; i++) {
      const flags = opts.getDayFlags(i)
      const hasText = !!(flags & 1)
      const hasImage = !!(flags & 2)
      const isPast = i < opts.todayIndex
      const isToday = i === opts.todayIndex

      let fill = '#111827' // future default
      if (isToday) fill = '#1e293b'
      else if (isPast) {
        if (hasText && hasImage) fill = '#4a5568'
        else if (hasImage) fill = '#3d4f5f'
        else if (hasText) fill = '#334155'
        else fill = '#1e293b'
      }
      colors[i] = fill
    }
    overviewBitmap = createOverviewImageData(layout.cols, layout.rows, opts.totalDays, colors)
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
    ctx.fillStyle = '#0f1117'
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
      }
    } else {
      if (overviewBitmap || bitmapCanvas) {
        overviewBitmap = null
        bitmapCanvas = null
      }
      renderDetail(ctx, camera, layout, vw, vh, (i: number) => {
        const flags = opts.getDayFlags(i)
        return {
          isPast: i < opts.todayIndex,
          isToday: i === opts.todayIndex,
          hasText: !!(flags & 1),
          hasImage: !!(flags & 2),
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
    destroy() {
      resizeObserver.disconnect()
      inputCleanup()
      if (rafId) cancelAnimationFrame(rafId)
    },
  }
}
