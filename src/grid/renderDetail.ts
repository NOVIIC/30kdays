import type { Camera } from './camera'
import type { Layout } from './layout'
import { screenToWorld, worldToScreen } from './camera'
import { getDayColor as getDayColorFn } from './palette'

export function renderDetail(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  layout: Layout,
  viewportW: number,
  viewportH: number,
  getDayInfo: (index: number) => {
    isPast: boolean
    isToday: boolean
    hasText: boolean
    hasImage: boolean
  },
): void {
  const { cellSize, cols, rows, totalDays } = layout
  const scale = camera.scale

  const tl = screenToWorld(camera, 0, 0)
  const br = screenToWorld(camera, viewportW, viewportH)

  const startCol = Math.max(0, Math.floor(tl.x / cellSize))
  const startRow = Math.max(0, Math.floor(tl.y / cellSize))
  const endCol = Math.min(cols - 1, Math.ceil(br.x / cellSize))
  const endRow = Math.min(rows - 1, Math.ceil(br.y / cellSize))

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const index = row * cols + col
      if (index >= totalDays) continue

      const info = getDayInfo(index)
      const color = getDayColorFn(info.isPast, info.isToday, info.hasText, info.hasImage)

      const { x, y } = worldToScreen(camera, col * cellSize, row * cellSize)
      const sz = cellSize * scale

      ctx.fillStyle = color.fill
      ctx.fillRect(x, y, sz, sz)

      ctx.strokeStyle = color.border
      ctx.lineWidth = Math.max(0.5, scale * 0.5)
      ctx.strokeRect(x, y, sz, sz)

      if (info.isToday) {
        ctx.strokeStyle = color.highlight
        ctx.lineWidth = Math.max(2, scale * 1.5)
        ctx.strokeRect(x - 1, y - 1, sz + 2, sz + 2)
      }

      if (info.hasText || info.hasImage) {
        const indicator = Math.max(2, sz * 0.2)
        ctx.fillStyle = color.highlight
        ctx.fillRect(x + sz - indicator - 1, y + sz - indicator - 1, indicator, indicator)
      }
    }
  }
}
