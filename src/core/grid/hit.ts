/**
 * 命中检测：屏幕坐标 → 日索引。
 * 末行不足一列数时的补位区域不算命中。
 */

import { screenToWorld, type Camera, type Point } from './camera'
import type { GridLayout } from './layout'

/** 屏幕坐标命中的日索引；落在网格外、补位区域或相机非法时返回 null。 */
export function hitTest(layout: GridLayout, camera: Camera, p: Point): number | null {
  if (!(camera.scale > 0)) return null
  const w = screenToWorld(camera, p)
  if (w.x < 0 || w.y < 0) return null
  const col = Math.floor(w.x / layout.cell)
  const row = Math.floor(w.y / layout.cell)
  if (col >= layout.cols || row >= layout.rows) return null
  const index = row * layout.cols + col
  return index < layout.total ? index : null
}
