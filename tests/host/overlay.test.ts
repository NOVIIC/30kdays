import { describe, expect, it } from 'vitest'
import {
  OverlayHub,
  parseOverlayInstructions,
  type OverlayInstruction,
} from '../../src/core/host/overlay'

/** 简化换算：合法日期映射为月份数字（仅测试用），无法换算返回 null。 */
function fakeDateToIndex(date: string): number | null {
  const m = /^2026-(\d{2})-\d{2}$/.exec(date)
  return m === null ? null : Number(m[1])
}

describe('parseOverlayInstructions', () => {
  it('接受合法指令（tint / dot / 兼有）', () => {
    const list = parseOverlayInstructions([
      { date: '2026-09-10', tint: { color: '#c2611e', intensity: 0.5 } },
      { date: '2026-09-11', dot: { color: '#b5462f' } },
      { date: '2026-09-12', tint: { color: '#C2611E', intensity: 1 }, dot: { color: '#000000' } },
    ])
    expect(list).toHaveLength(3)
    expect(list[0].tint).toEqual({ color: '#c2611e', intensity: 0.5 })
  })

  it('拒绝非数组与各种非法字段', () => {
    expect(() => parseOverlayInstructions('x')).toThrow('数组')
    expect(() => parseOverlayInstructions([null])).toThrow('不是对象')
    expect(() =>
      parseOverlayInstructions([{ tint: { color: '#c2611e', intensity: 0.5 } }]),
    ).toThrow('缺少 date')
    expect(() =>
      parseOverlayInstructions([{ date: '2026-13-01', dot: { color: '#000000' } }]),
    ).toThrow('date 非法')
    expect(() =>
      parseOverlayInstructions([{ date: '2026-09-10', tint: { color: 'red', intensity: 0.5 } }]),
    ).toThrow('tint.color')
    expect(() =>
      parseOverlayInstructions([
        { date: '2026-09-10', tint: { color: '#c2611e', intensity: 1.5 } },
      ]),
    ).toThrow('intensity')
    expect(() =>
      parseOverlayInstructions([{ date: '2026-09-10', dot: { color: '#c2611' } }]),
    ).toThrow('dot.color')
    expect(() => parseOverlayInstructions([{ date: '2026-09-10' }])).toThrow('至少要含')
  })
})

describe('OverlayHub', () => {
  const instr = (date: string, color: string): OverlayInstruction => ({
    date,
    tint: { color, intensity: 0.5 },
    dot: { color },
  })

  it('收录指令并按日索引物化；无法换算的日期丢弃', () => {
    const hub = new OverlayHub(fakeDateToIndex)
    let latest!: ReadonlyMap<number, unknown>
    hub.subscribe((m) => (latest = m))
    hub.set('todo', 'schedule', [instr('2026-09-10', '#c2611e'), instr('2020-01-01', '#ffffff')])
    expect(hub.describe()).toEqual([{ extId: 'todo', layerId: 'schedule', count: 1 }])
    expect(latest.size).toBe(1)
    expect(latest.has(9)).toBe(true)
  })

  it('subscribe 立即回放并在变更时收到合并结果', () => {
    const hub = new OverlayHub(fakeDateToIndex)
    const seen: ReadonlyMap<number, { tints: unknown[]; dots: string[] }>[] = []
    const unsub = hub.subscribe((m) => seen.push(m))
    expect(seen).toHaveLength(1)
    expect(seen[0].size).toBe(0)

    hub.set('todo', 'schedule', [instr('2026-09-10', '#c2611e')])
    expect(seen).toHaveLength(2)
    const day = seen[1].get(9)!
    expect(day.tints).toEqual([{ color: '#c2611e', intensity: 0.5 }])
    expect(day.dots).toEqual(['#c2611e'])

    unsub()
    hub.set('todo', 'schedule', [])
    expect(seen).toHaveLength(2) // 退订后不再收到
  })

  it('多扩展同一天按注册序合并', () => {
    const hub = new OverlayHub(fakeDateToIndex)
    let latest!: ReadonlyMap<number, { tints: { color: string }[]; dots: string[] }>
    hub.subscribe((m) => (latest = m))
    hub.set('a-ext', 'l1', [instr('2026-09-10', '#111111')])
    hub.set('b-ext', 'l1', [instr('2026-09-10', '#222222')])
    expect(latest.get(9)!.dots).toEqual(['#111111', '#222222'])
  })

  it('整层替换：再次 set 覆盖同层旧指令，注册序不变', () => {
    const hub = new OverlayHub(fakeDateToIndex)
    let latest!: ReadonlyMap<number, { dots: string[] }>
    hub.subscribe((m) => (latest = m))
    hub.set('a-ext', 'l1', [instr('2026-09-10', '#111111')])
    hub.set('b-ext', 'l1', [instr('2026-09-10', '#222222')])
    hub.set('a-ext', 'l1', [instr('2026-09-10', '#333333')])
    expect(latest.get(9)!.dots).toEqual(['#333333', '#222222'])
  })

  it('空数组清除该层；clear 清除扩展全部层', () => {
    const hub = new OverlayHub(fakeDateToIndex)
    hub.set('a-ext', 'l1', [instr('2026-09-10', '#111111')])
    hub.set('a-ext', 'l2', [instr('2026-10-10', '#222222')])
    hub.set('b-ext', 'l1', [instr('2026-11-10', '#333333')])
    hub.set('a-ext', 'l1', [])
    expect(hub.describe().map((l) => l.layerId)).toEqual(['l2', 'l1'])
    hub.clear('a-ext')
    expect(hub.describe()).toEqual([{ extId: 'b-ext', layerId: 'l1', count: 1 }])
  })
})
