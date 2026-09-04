/**
 * 格子覆盖（gridOverlays 派发点）：扩展以声明式指令描述格子标记，宿主本地绘制。
 *
 * 契约要点：
 * - 指令以**日期**（YYYY-MM-DD）寻址——扩展无需关心人生配置与日索引换算，
 *   Hub 在收录时经注入的 dateToIndex 转换；无法换算的（出生前/寿命外）丢弃。
 * - **推模型 + 整层替换**：扩展每次推送某层（manifest 声明的 layer id）的全量指令；
 *   Hub 把各扩展各层按注册顺序合并为按天物化表，通知订阅者。
 * - 渲染热路径（逐格）只读物化表，不回调扩展——性能关键路径不走链（见 docs/Extensions.md）。
 */

import { parseISODate } from '../domain/life'
import type { DayOverlay } from '../grid/overlay'

export type { DayOverlay }

/** 染色指令：总览按强度混入像素，高清混入填充色。 */
export type OverlayTint = {
  /** #rrggbb。 */
  color: string
  /** 混入强度 0..1（0 无效果，1 完全替换）。 */
  intensity: number
}

/** 单条覆盖指令（扩展侧契约，经 host.grid.setOverlays 推送）。 */
export type OverlayInstruction = {
  /** 目标日期，YYYY-MM-DD（本地日历日语义）。 */
  date: string
  /** 染色（可选）。 */
  tint?: OverlayTint
  /** 高清模式右下角小圆点（可选；颜色 #rrggbb）。 */
  dot?: { color: string }
}

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

/** 校验单条指令；非法时抛错（信息指明下标与原因）。 */
function validateInstruction(raw: unknown, index: number): OverlayInstruction {
  const where = `覆盖指令[${index}]`
  if (typeof raw !== 'object' || raw === null) throw new Error(`${where} 不是对象`)
  const o = raw as Record<string, unknown>
  if (typeof o.date !== 'string') throw new Error(`${where} 缺少 date`)
  try {
    parseISODate(o.date)
  } catch {
    throw new Error(`${where} 的 date 非法：${o.date}`)
  }
  let tint: OverlayTint | undefined
  if (o.tint !== undefined) {
    if (typeof o.tint !== 'object' || o.tint === null) throw new Error(`${where} 的 tint 不是对象`)
    const t = o.tint as Record<string, unknown>
    if (typeof t.color !== 'string' || !HEX_COLOR_RE.test(t.color)) {
      throw new Error(`${where} 的 tint.color 须为 #rrggbb`)
    }
    if (typeof t.intensity !== 'number' || t.intensity < 0 || t.intensity > 1) {
      throw new Error(`${where} 的 tint.intensity 须在 0..1`)
    }
    tint = { color: t.color, intensity: t.intensity }
  }
  let dot: { color: string } | undefined
  if (o.dot !== undefined) {
    if (typeof o.dot !== 'object' || o.dot === null) throw new Error(`${where} 的 dot 不是对象`)
    const d = o.dot as Record<string, unknown>
    if (typeof d.color !== 'string' || !HEX_COLOR_RE.test(d.color)) {
      throw new Error(`${where} 的 dot.color 须为 #rrggbb`)
    }
    dot = { color: d.color }
  }
  if (tint === undefined && dot === undefined) {
    throw new Error(`${where} 至少要含 tint 或 dot 之一`)
  }
  return { date: o.date, tint, dot }
}

/** 校验指令数组；任一非法则整体拒绝（抛错）。 */
export function parseOverlayInstructions(raw: unknown): OverlayInstruction[] {
  if (!Array.isArray(raw)) throw new Error('覆盖指令必须是数组')
  return raw.map(validateInstruction)
}

/** 合并结果的订阅回调。 */
export type OverlayListener = (merged: ReadonlyMap<number, DayOverlay>) => void

/** 某层的注册情况（观测用）。 */
export type OverlayLayerInfo = { extId: string; layerId: string; count: number }

/**
 * 覆盖指令汇集中心：收录各扩展各层的全量指令，按天物化合并并通知订阅者。
 * dateToIndex 由宿主注入（日期 → 日索引；无法换算返回 null）。
 */
export class OverlayHub {
  /** 各层物化结果（Map 迭代序即注册序，作为同一天多条指令的混入顺序）。 */
  private layers = new Map<
    string,
    { extId: string; layerId: string; byDay: Map<number, DayOverlay> }
  >()
  private listeners = new Set<OverlayListener>()
  private merged: ReadonlyMap<number, DayOverlay> = new Map()

  constructor(private dateToIndex: (date: string) => number | null) {}

  /** 收录某层全量指令（整层替换）；空数组等同清除该层。 */
  set(extId: string, layerId: string, instructions: OverlayInstruction[]): void {
    const key = `${extId}/${layerId}`
    if (instructions.length === 0) {
      this.layers.delete(key)
    } else {
      const byDay = new Map<number, DayOverlay>()
      for (const instr of instructions) {
        const day = this.dateToIndex(instr.date)
        if (day === null) continue
        let entry = byDay.get(day)
        if (entry === undefined) {
          entry = { tints: [], dots: [] }
          byDay.set(day, entry)
        }
        if (instr.tint !== undefined) entry.tints.push(instr.tint)
        if (instr.dot !== undefined) entry.dots.push(instr.dot.color)
      }
      // 层已存在时保留原键位（注册序不变），仅替换内容
      const existing = this.layers.get(key)
      if (existing !== undefined) existing.byDay = byDay
      else this.layers.set(key, { extId, layerId, byDay })
    }
    this.rebuild()
  }

  /** 清除某扩展的全部层（停用/卸载时调用）。 */
  clear(extId: string): void {
    let changed = false
    for (const [key, layer] of this.layers) {
      if (layer.extId === extId) {
        this.layers.delete(key)
        changed = true
      }
    }
    if (changed) this.rebuild()
  }

  /** 订阅合并结果；立即回放当前值，返回退订函数。 */
  subscribe(listener: OverlayListener): () => void {
    this.listeners.add(listener)
    listener(this.merged)
    return () => this.listeners.delete(listener)
  }

  /** 各层注册情况（观测用）。 */
  describe(): OverlayLayerInfo[] {
    return [...this.layers.values()].map((l) => ({
      extId: l.extId,
      layerId: l.layerId,
      count: l.byDay.size,
    }))
  }

  /** 重建合并表并通知订阅者。 */
  private rebuild(): void {
    const merged = new Map<number, DayOverlay>()
    for (const layer of this.layers.values()) {
      for (const [day, overlay] of layer.byDay) {
        let entry = merged.get(day)
        if (entry === undefined) {
          entry = { tints: [], dots: [] }
          merged.set(day, entry)
        }
        entry.tints.push(...overlay.tints)
        entry.dots.push(...overlay.dots)
      }
    }
    this.merged = merged
    for (const listener of this.listeners) listener(merged)
  }
}
