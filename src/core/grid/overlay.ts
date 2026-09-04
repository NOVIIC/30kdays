/**
 * 物化后的单日覆盖（宿主绘制用）：由 Host 的 gridOverlays 派发点（core/host/overlay.ts）
 * 合并各扩展的声明式指令产出，渲染器直接消费。颜色为 #rrggbb 字符串，渲染器收录时打包。
 */

/** 单格覆盖：染色依序混入底色（总览混像素、高清混填充色），圆点在高清模式右下角横排。 */
export type DayOverlay = {
  /** 依序混入的染色：颜色 + 强度 0..1。 */
  tints: { color: string; intensity: number }[]
  /** 右下角小圆点颜色（依序自右向左横排）。 */
  dots: string[]
}
