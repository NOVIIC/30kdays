export type Camera = {
  scale: number
  offsetX: number
  offsetY: number
}

export function createCamera(): Camera {
  return { scale: 1, offsetX: 0, offsetY: 0 }
}

export function screenToWorld(
  camera: Camera,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return {
    x: sx / camera.scale + camera.offsetX,
    y: sy / camera.scale + camera.offsetY,
  }
}

export function worldToScreen(
  camera: Camera,
  wx: number,
  wy: number,
): { x: number; y: number } {
  return {
    x: (wx - camera.offsetX) * camera.scale,
    y: (wy - camera.offsetY) * camera.scale,
  }
}

export function zoomAt(camera: Camera, sx: number, sy: number, factor: number): Camera {
  const newScale = camera.scale * factor
  const worldX = sx / camera.scale + camera.offsetX
  const worldY = sy / camera.scale + camera.offsetY
  return {
    scale: newScale,
    offsetX: worldX - sx / newScale,
    offsetY: worldY - sy / newScale,
  }
}
