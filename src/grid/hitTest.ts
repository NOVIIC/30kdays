import type { Layout } from './layout'

export function indexFromPoint(
  layout: Layout,
  worldX: number,
  worldY: number,
): number | null {
  if (worldX < 0 || worldY < 0) return null
  if (layout.cellSize <= 0) return null
  const col = Math.floor(worldX / layout.cellSize)
  const row = Math.floor(worldY / layout.cellSize)
  if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return null
  const index = row * layout.cols + col
  return index < layout.totalDays ? index : null
}
