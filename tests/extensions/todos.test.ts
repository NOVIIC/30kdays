import { describe, expect, it } from 'vitest'
import {
  addDays,
  checkIn,
  compareInGroup,
  createTodo,
  formatDateCN,
  groupOf,
  parseTodo,
  relevantDate,
  scheduleLabel,
  setDone,
  spanDays,
  TODO_FORMAT_VERSION,
  todoPath,
  todosForDate,
  withSchedule,
  type Todo,
  type TodoSchedule,
} from '../../extensions/todo/src/todos'

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

/** 构造合法的可解析原始文档。 */
function raw(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'a',
    text: '买菜',
    schedule: { kind: 'none' },
    checkIns: [],
    done: false,
    createdAt: 100,
    updatedAt: 200,
    version: TODO_FORMAT_VERSION,
    ...partial,
  }
}

describe('todoPath', () => {
  it('指向 todos/<id>.json', () => {
    expect(todoPath('abc')).toEqual(['todos', 'abc.json'])
  })
})

describe('createTodo', () => {
  it('生成带版本头的空待办，默认无日期、未完成', () => {
    expect(createTodo('id-1', 123)).toEqual({
      id: 'id-1',
      text: '',
      schedule: { kind: 'none' },
      checkIns: [],
      done: false,
      createdAt: 123,
      updatedAt: 123,
      version: TODO_FORMAT_VERSION,
    })
  })
})

describe('parseTodo', () => {
  it('接受合法文档并归一化版本号', () => {
    expect(parseTodo(raw({ version: 99 }))).toEqual(
      todo({ id: 'a', text: '买菜', createdAt: 100, updatedAt: 200 }),
    )
  })

  it('接受截止日与区间调度', () => {
    const deadline = parseTodo(raw({ schedule: { kind: 'deadline', due: '2026-09-10' } }))
    expect(deadline?.schedule).toEqual({ kind: 'deadline', due: '2026-09-10' })
    const range = parseTodo(
      raw({
        schedule: { kind: 'range', start: '2026-09-01', end: '2026-09-30', requiredDays: 10 },
        checkIns: ['2026-09-03', '2026-09-01'],
      }),
    )
    expect(range?.checkIns).toEqual(['2026-09-01', '2026-09-03'])
  })

  it('拒绝非对象与缺字段', () => {
    expect(parseTodo(null)).toBeNull()
    expect(parseTodo('x')).toBeNull()
    expect(parseTodo(raw({ id: '' }))).toBeNull()
    expect(parseTodo(raw({ text: 1 }))).toBeNull()
    expect(parseTodo(raw({ done: 'yes' }))).toBeNull()
    expect(parseTodo(raw({ createdAt: NaN }))).toBeNull()
  })

  it('拒绝非法调度', () => {
    expect(parseTodo(raw({ schedule: null }))).toBeNull()
    expect(parseTodo(raw({ schedule: { kind: 'someday' } }))).toBeNull()
    expect(parseTodo(raw({ schedule: { kind: 'deadline', due: '2026-13-01' } }))).toBeNull()
    expect(parseTodo(raw({ schedule: { kind: 'deadline', due: '2026-02-30' } }))).toBeNull()
    // 区间 start > end
    expect(
      parseTodo(
        raw({
          schedule: { kind: 'range', start: '2026-09-10', end: '2026-09-01', requiredDays: 3 },
        }),
      ),
    ).toBeNull()
    // requiredDays 非正整数
    expect(
      parseTodo(
        raw({
          schedule: { kind: 'range', start: '2026-09-01', end: '2026-09-10', requiredDays: 0 },
        }),
      ),
    ).toBeNull()
  })

  it('拒绝非法打卡记录（非数组、坏日期、区间外字段类型）', () => {
    expect(parseTodo(raw({ checkIns: '2026-09-01' }))).toBeNull()
    expect(
      parseTodo(
        raw({
          schedule: { kind: 'range', start: '2026-09-01', end: '2026-09-30', requiredDays: 2 },
          checkIns: ['2026-09-01', 'bad'],
        }),
      ),
    ).toBeNull()
  })

  it('非区间型的 checkIns 归一化为空数组', () => {
    const parsed = parseTodo(raw({ checkIns: ['2026-09-01'] }))
    expect(parsed?.checkIns).toEqual([])
  })

  it('区间型打卡记录去重并升序', () => {
    const parsed = parseTodo(
      raw({
        schedule: { kind: 'range', start: '2026-09-01', end: '2026-09-30', requiredDays: 5 },
        checkIns: ['2026-09-05', '2026-09-01', '2026-09-05'],
      }),
    )
    expect(parsed?.checkIns).toEqual(['2026-09-01', '2026-09-05'])
  })
})

describe('setDone / withSchedule', () => {
  it('setDone 切换完成标志；无变化原样返回', () => {
    const t = todo({ id: 'a', updatedAt: 1 })
    expect(setDone(t, true, 99)).toMatchObject({ done: true, updatedAt: 99 })
    expect(setDone(t, false, 99)).toBe(t)
  })

  it('withSchedule 切出区间型时清空打卡记录', () => {
    const schedule: TodoSchedule = {
      kind: 'range',
      start: '2026-09-01',
      end: '2026-09-30',
      requiredDays: 3,
    }
    const t = todo({ id: 'a', schedule, checkIns: ['2026-09-01'], updatedAt: 1 })
    const next = withSchedule(t, { kind: 'deadline', due: '2026-09-10' }, 99)
    expect(next.checkIns).toEqual([])
    expect(next.updatedAt).toBe(99)
    // 区间 → 区间保留打卡
    const kept = withSchedule(t, { ...schedule, requiredDays: 5 }, 100)
    expect(kept.checkIns).toEqual(['2026-09-01'])
  })
})

describe('checkIn', () => {
  const range: TodoSchedule = {
    kind: 'range',
    start: '2026-09-01',
    end: '2026-09-30',
    requiredDays: 2,
  }

  it('记录打卡日期并保持升序', () => {
    const t = todo({ id: 'a', schedule: range, checkIns: ['2026-09-03'] })
    expect(checkIn(t, '2026-09-01', 9).checkIns).toEqual(['2026-09-01', '2026-09-03'])
  })

  it('重复打卡、区间外日期、非区间型均不生效', () => {
    const t = todo({ id: 'a', schedule: range, checkIns: ['2026-09-01'] })
    expect(checkIn(t, '2026-09-01', 9)).toBe(t)
    expect(checkIn(t, '2026-10-01', 9)).toBe(t)
    const plain = todo({ id: 'b' })
    expect(checkIn(plain, '2026-09-01', 9)).toBe(plain)
  })

  it('打卡数达标自动置完成', () => {
    const t = todo({ id: 'a', schedule: range, checkIns: ['2026-09-01'] })
    const next = checkIn(t, '2026-09-02', 9)
    expect(next.checkIns).toHaveLength(2)
    expect(next.done).toBe(true)
  })

  it('已完成的待办打卡后保持完成', () => {
    const t = todo({ id: 'a', schedule: range, checkIns: [], done: true })
    expect(checkIn(t, '2026-09-01', 9).done).toBe(true)
  })
})

describe('groupOf', () => {
  const today = '2026-09-04'

  it('已完成优先于一切分组', () => {
    expect(groupOf(todo({ id: 'a', done: true }), today)).toBe('done')
    expect(
      groupOf(
        todo({ id: 'a', done: true, schedule: { kind: 'deadline', due: '2026-09-01' } }),
        today,
      ),
    ).toBe('done')
  })

  it('无日期归入 none', () => {
    expect(groupOf(todo({ id: 'a' }), today)).toBe('none')
  })

  it('截止日：过期 → 未达成；今天 → 今日；7 日内 → 近 7 日；更远 → 之后', () => {
    const due = (due: string) => todo({ id: 'a', schedule: { kind: 'deadline', due } })
    expect(groupOf(due('2026-09-03'), today)).toBe('failed')
    expect(groupOf(due('2026-09-04'), today)).toBe('today')
    expect(groupOf(due('2026-09-05'), today)).toBe('week')
    expect(groupOf(due('2026-09-11'), today)).toBe('week') // today+7 边界
    expect(groupOf(due('2026-09-12'), today)).toBe('later')
  })

  it('区间：结束已过 → 未达成；覆盖今天 → 今日；未开始按 start 归入近 7 日/之后', () => {
    const range = (start: string, end: string) =>
      todo({ id: 'a', schedule: { kind: 'range', start, end, requiredDays: 3 } })
    expect(groupOf(range('2026-08-01', '2026-09-03'), today)).toBe('failed')
    expect(groupOf(range('2026-09-01', '2026-09-30'), today)).toBe('today')
    expect(groupOf(range('2026-09-04', '2026-09-10'), today)).toBe('today') // start === today
    expect(groupOf(range('2026-09-11', '2026-09-20'), today)).toBe('week') // start 为 today+7
    expect(groupOf(range('2026-09-12', '2026-09-30'), today)).toBe('later')
  })
})

describe('relevantDate', () => {
  it('deadline 取 due；range 未开始取 start、进行中/已过期取 end；无日期为 null', () => {
    const today = '2026-09-04'
    expect(relevantDate(todo({ id: 'a' }), today)).toBeNull()
    expect(
      relevantDate(todo({ id: 'a', schedule: { kind: 'deadline', due: '2026-09-10' } }), today),
    ).toBe('2026-09-10')
    const range = (start: string, end: string) =>
      todo({ id: 'a', schedule: { kind: 'range', start, end, requiredDays: 1 } })
    expect(relevantDate(range('2026-09-10', '2026-09-20'), today)).toBe('2026-09-10')
    expect(relevantDate(range('2026-09-01', '2026-09-20'), today)).toBe('2026-09-20')
    expect(relevantDate(range('2026-08-01', '2026-08-31'), today)).toBe('2026-08-31')
  })
})

describe('compareInGroup', () => {
  const today = '2026-09-04'

  it('日期组按相关日期升序，相同按 updatedAt 倒序', () => {
    const a = todo({ id: 'a', schedule: { kind: 'deadline', due: '2026-09-06' }, updatedAt: 1 })
    const b = todo({ id: 'b', schedule: { kind: 'deadline', due: '2026-09-05' }, updatedAt: 1 })
    const c = todo({ id: 'c', schedule: { kind: 'deadline', due: '2026-09-05' }, updatedAt: 9 })
    const list = [a, b, c].sort(compareInGroup('week', today))
    expect(list.map((t) => t.id)).toEqual(['c', 'b', 'a'])
  })

  it('无日期与已完成组按 updatedAt 倒序', () => {
    const a = todo({ id: 'a', updatedAt: 1 })
    const b = todo({ id: 'b', updatedAt: 5 })
    const list = [a, b].sort(compareInGroup('none', today))
    expect(list.map((t) => t.id)).toEqual(['b', 'a'])
    const doneList = [a, b].sort(compareInGroup('done', today))
    expect(doneList.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('todosForDate', () => {
  const range = (start: string, end: string): TodoSchedule => ({
    kind: 'range',
    start,
    end,
    requiredDays: 1,
  })

  it('截止日恰为该天 / 区间覆盖该天（含两端）才相关；无日期恒不相关', () => {
    const list = [
      todo({ id: 'due-hit', schedule: { kind: 'deadline', due: '2026-09-05' } }),
      todo({ id: 'due-miss', schedule: { kind: 'deadline', due: '2026-09-06' } }),
      todo({ id: 'range-hit', schedule: range('2026-09-01', '2026-09-30') }),
      todo({ id: 'range-start', schedule: range('2026-09-05', '2026-09-10') }),
      todo({ id: 'range-miss', schedule: range('2026-09-06', '2026-09-10') }),
      todo({ id: 'none' }),
    ]
    const ids = todosForDate(list, '2026-09-05').map((t) => t.id)
    expect(ids).toEqual(['due-hit', 'range-hit', 'range-start'])
  })

  it('已完成沉底，各自保持传入顺序', () => {
    const list = [
      todo({ id: 'done-a', done: true, schedule: { kind: 'deadline', due: '2026-09-05' } }),
      todo({ id: 'open-b', schedule: range('2026-09-01', '2026-09-30') }),
      todo({ id: 'done-c', done: true, schedule: range('2026-09-01', '2026-09-30') }),
      todo({ id: 'open-d', schedule: { kind: 'deadline', due: '2026-09-05' } }),
    ]
    const ids = todosForDate(list, '2026-09-05').map((t) => t.id)
    expect(ids).toEqual(['open-b', 'open-d', 'done-a', 'done-c'])
  })
})

describe('addDays / spanDays', () => {
  it('跨月加天数与区间天数（含两端）', () => {
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(spanDays('2026-09-04', '2026-09-04')).toBe(1)
    expect(spanDays('2026-09-01', '2026-09-30')).toBe(30)
  })
})

describe('formatDateCN / scheduleLabel', () => {
  const now = new Date(2026, 8, 4) // 本地 2026-09-04

  it('当年省略年份，跨年带年份', () => {
    expect(formatDateCN('2026-09-10', now)).toBe('9月10日')
    expect(formatDateCN('2027-01-01', now)).toBe('2027年1月1日')
  })

  it('调度标签', () => {
    expect(scheduleLabel(todo({ id: 'a' }), now)).toBe('无日期')
    expect(
      scheduleLabel(todo({ id: 'a', schedule: { kind: 'deadline', due: '2026-09-10' } }), now),
    ).toBe('截止 9月10日')
    expect(
      scheduleLabel(
        todo({
          id: 'a',
          schedule: { kind: 'range', start: '2026-09-01', end: '2026-09-30', requiredDays: 10 },
          checkIns: ['2026-09-01', '2026-09-02', '2026-09-03'],
        }),
        now,
      ),
    ).toBe('9月1日 ~ 9月30日 · 打卡 3/10')
  })
})
