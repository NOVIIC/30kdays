/**
 * 网格布局：由总天数与视口尺寸推导列数、行数与单元格边长。
 * 列数取 round(sqrt(N × 视口宽高比))，正方形格贴合屏幕，
 * 使 scale = 1 时整张网格恰好落入视口。
 * 布局使用世界坐标（未经相机变换）；视口变化时重新计算布局。
 */

/** 网格布局：世界坐标下的几何参数。 */
export type GridLayout = {
  /** 总天数（格子数）。 */
  total: number
  /** 列数。 */
  cols: number
  /** 行数。 */
  rows: number
  /** 单元格边长（世界单位；scale = 1 时即屏幕像素）。 */
  cell: number
  /** 网格世界宽度 = cols × cell。 */
  width: number
  /** 网格世界高度 = rows × cell。 */
  height: number
}

/** 格子行列坐标。 */
export type CellCoord = {
  col: number
  row: number
}

/** 计算布局；入参非正数时抛错。 */
export function computeLayout(total: number, viewportW: number, viewportH: number): GridLayout {
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error(`无效的总天数：${total}`)
  }
  if (!(viewportW > 0) || !(viewportH > 0)) {
    throw new Error(`无效的视口尺寸：${viewportW}×${viewportH}`)
  }
  const cols = Math.max(1, Math.round(Math.sqrt(total * (viewportW / viewportH))))
  const rows = Math.ceil(total / cols)
  const cell = Math.min(viewportW / cols, viewportH / rows)
  return { total, cols, rows, cell, width: cols * cell, height: rows * cell }
}

/** 日索引 → 行列坐标；索引越界时抛错。 */
export function cellCoord(layout: GridLayout, index: number): CellCoord {
  if (!Number.isInteger(index) || index < 0 || index >= layout.total) {
    throw new RangeError(`日索引越界：${index}`)
  }
  return { col: index % layout.cols, row: Math.floor(index / layout.cols) }
}

/** 日索引 → 单元格左上角世界坐标；索引越界时抛错。 */
export function cellOrigin(layout: GridLayout, index: number): { x: number; y: number } {
  const { col, row } = cellCoord(layout, index)
  return { x: col * layout.cell, y: row * layout.cell }
}
