import type { Camera } from './camera'
import type { Layout } from './layout'
import { screenToWorld, worldToScreen } from './camera'
import { dayFill, type GridColors } from './palette'

export type DayDetailInfo = {
  isPast: boolean
  isToday: boolean
  hasContent: boolean
  hasTodo: boolean
}

export function renderDetail(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  layout: Layout,
  viewportW: number,
  viewportH: number,
  colors: GridColors,
  getDayInfo: (index: number) => DayDetailInfo,
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
      const { x, y } = worldToScreen(camera, col * cellSize, row * cellSize)
      const sz = cellSize * scale

      // 格子内缩，背景色透出形成"网格留白"
      const gap = Math.min(1.5, Math.max(0.5, sz * 0.12))
      const cx = x + gap / 2
      const cy = y + gap / 2
      const cs = sz - gap

      ctx.fillStyle = dayFill(colors, info)
      const r = sz >= 16 ? 2.5 : sz >= 9 ? 1.5 : 0
      if (r > 0) {
        ctx.beginPath()
        ctx.roundRect(cx, cy, cs, cs, r)
        ctx.fill()
      } else {
        ctx.fillRect(cx, cy, cs, cs)
      }

      if (info.isToday) {
        ctx.strokeStyle = colors.accent
        ctx.lineWidth = Math.max(1.5, scale * 1.2)
        if (r > 0) {
          ctx.beginPath()
          ctx.roundRect(cx - 1.5, cy - 1.5, cs + 3, cs + 3, r + 1.5)
          ctx.stroke()
        } else {
          ctx.strokeRect(cx - 1.5, cy - 1.5, cs + 3, cs + 3)
        }
      } else if (info.hasTodo && sz >= 7) {
        // todo 截止日标记点（今天已有高亮，不再叠加）
        const dr = Math.max(1.2, sz * 0.09)
        ctx.fillStyle = colors.accent
        ctx.beginPath()
        ctx.arc(cx + cs - dr * 1.4, cy + cs - dr * 1.4, dr, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
