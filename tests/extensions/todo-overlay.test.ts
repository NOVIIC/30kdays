import { describe, expect, it } from 'vitest'
import { COLOR_ACCENT, COLOR_FAILED, computeOverlays } from '../../extensions/todo/src/overlay'
import { TODO_FORMAT_VERSION, type Todo, type TodoSchedule } from '../../extensions/todo/src/todos'

/** 构造测试用待办。 */
function todo(partial: Partial<Todo> & { id: string }): Todo {
  return {
    text: '',
    schedule: { kind: 'none' },
    checkIns: [],
    done: false,
    createdAt: 0,
    updatedAt: 0,
    version: TODO_FORMAT_VERSION,
    ...partial,
  }
}

describe('computeOverlays', () => {
  const today = '2026-09-04'

  it('已完成与无日期不标记', () => {
    const list = [
      todo({ id: 'a' }),
      todo({ id: 'b', done: true, schedule: { kind: 'deadline', due: '2026-09-01' } }),
    ]
    expect(computeOverlays(list, today)).toEqual([])
  })

  it('截止日按 过期/今天/未来 分档标记', () => {
    const due = (due: string) => todo({ id: due, schedule: { kind: 'deadline', due } })
    const result = computeOverlays([due('2026-09-01'), due('2026-09-04'), due('2026-09-10')], today)
    expect(result).toEqual([
      {
        date: '2026-09-01',
        tint: { color: COLOR_FAILED, intensity: 0.9 },
        dot: { color: COLOR_FAILED },
      },
      {
        date: '2026-09-04',
        tint: { color: COLOR_ACCENT, intensity: 0.8 },
        dot: { color: COLOR_ACCENT },
      },
      {
        date: '2026-09-10',
        tint: { color: COLOR_ACCENT, intensity: 0.3 },
        dot: { color: COLOR_ACCENT },
      },
    ])
  })

  it('区间型标记结束日', () => {
    const range: TodoSchedule = {
      kind: 'range',
      start: '2026-09-01',
      end: '2026-09-30',
      requiredDays: 10,
    }
    const result = computeOverlays([todo({ id: 'a', schedule: range })], today)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-09-30')
  })
})
