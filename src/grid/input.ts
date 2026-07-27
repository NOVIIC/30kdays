import type { Camera } from './camera'
import { screenToWorld, zoomAt } from './camera'

export interface InputCallbacks {
  onZoom: (factor: number, sx: number, sy: number) => void
  onPan: (dx: number, dy: number) => void
  onClick: (sx: number, sy: number) => void
}

export function setupInput(
  canvas: HTMLCanvasElement,
  camera: () => Camera,
  callbacks: InputCallbacks,
): () => void {
  let dragging = false
  let dragStartX = 0
  let dragStartY = 0
  let hasDragged = false

  function onPointerDown(e: PointerEvent) {
    dragging = true
    hasDragged = false
    dragStartX = e.clientX
    dragStartY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasDragged = true
    }
    dragStartX = e.clientX
    dragStartY = e.clientY
    callbacks.onPan(dx, dy)
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    canvas.releasePointerCapture(e.pointerId)
    if (!hasDragged) {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      callbacks.onClick(sx, sy)
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    callbacks.onZoom(factor, sx, sy)
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('wheel', onWheel)
  }
}
