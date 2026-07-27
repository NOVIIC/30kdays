export type Layout = {
  cols: number
  rows: number
  cellSize: number
  totalDays: number
}

export function computeLayout(totalDays: number, viewportW: number, viewportH: number): Layout {
  if (totalDays <= 0 || viewportW <= 0 || viewportH <= 0) {
    return { cols: 0, rows: 0, cellSize: 0, totalDays }
  }
  const aspect = viewportW / viewportH
  const cols = Math.max(1, Math.round(Math.sqrt(totalDays * aspect)))
  const rows = Math.ceil(totalDays / cols)
  const cellSize = Math.min(viewportW / cols, viewportH / rows)
  return { cols, rows, cellSize, totalDays }
}
