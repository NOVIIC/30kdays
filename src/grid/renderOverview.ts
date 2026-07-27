function hexToRGBA(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function createOverviewImageData(
  cols: number,
  rows: number,
  totalDays: number,
  colors: string[],
): ImageData {
  const imageData = new ImageData(cols, rows)
  const buf = new Uint32Array(imageData.data.buffer)
  for (let i = 0; i < totalDays; i++) {
    buf[i] = hexToRGBA(colors[i])
  }
  return imageData
}
