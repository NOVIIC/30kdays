/**
 * 相机：世界坐标 → 屏幕坐标的缩放平移变换。
 * screen = world × scale + offset；缩放绕指定屏幕点（光标 / 双指中点）进行，
 * 保证缩放前后该屏幕点对应的世界点不变。
 */

import type { GridLayout } from './layout'

/** 相机状态。 */
export type Camera = {
  /** 缩放倍率；1 时整张网格贴合视口。 */
  scale: number
  /** 屏幕偏移 x（像素）。 */
  x: number
  /** 屏幕偏移 y（像素）。 */
  y: number
}

/** 平面点（屏幕或世界坐标）。 */
export type Point = { x: number; y: number }

/** 缩放下限：允许把整网缩小到贴合尺寸的一半。 */
export const MIN_SCALE = 0.5

/** 缩放上限：避免单格被放大到失去意义。 */
export const MAX_SCALE = 64

/** 创建单位相机（scale = 1，无偏移）。 */
export function createCamera(): Camera {
  return { scale: 1, x: 0, y: 0 }
}

/** 创建使网格居中贴合视口的相机（scale = 1，网格在视口内居中）。 */
export function fitCamera(layout: GridLayout, viewportW: number, viewportH: number): Camera {
  return {
    scale: 1,
    x: (viewportW - layout.width) / 2,
    y: (viewportH - layout.height) / 2,
  }
}

/** 世界坐标 → 屏幕坐标。 */
export function worldToScreen(camera: Camera, p: Point): Point {
  return { x: p.x * camera.scale + camera.x, y: p.y * camera.scale + camera.y }
}

/** 屏幕坐标 → 世界坐标。 */
export function screenToWorld(camera: Camera, p: Point): Point {
  return { x: (p.x - camera.x) / camera.scale, y: (p.y - camera.y) / camera.scale }
}

/** 平移相机（屏幕像素增量），返回新相机。 */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/**
 * 以屏幕点 pivot 为中心缩放 factor 倍，返回新相机。
 * 缩放倍率夹在 [min, max]；pivot 对应的世界点在缩放前后保持不动。
 */
export function zoomAt(
  camera: Camera,
  pivot: Point,
  factor: number,
  min: number = MIN_SCALE,
  max: number = MAX_SCALE,
): Camera {
  const scale = Math.min(max, Math.max(min, camera.scale * factor))
  if (scale === camera.scale) return camera
  const anchor = screenToWorld(camera, pivot)
  return {
    scale,
    x: pivot.x - anchor.x * scale,
    y: pivot.y - anchor.y * scale,
  }
}
