import { describe, it, expect } from 'vitest'
import {
  createTodo,
  isComplete,
  isFailed,
  todoStatus,
  toggleCheckin,
  toggleDone,
  groupOf,
  groupTodos,
  sortInGroup,
  validateSchedule,
  daysBetween,
  deadlineDayIndices,
  type Todo,
} from '../../src/domain/todo'

const TODAY = '2026-07-27'

function deadlineTodo(due: string, done = false): Todo {
  return { ...createTodo('t', { kind: 'deadline', due }), done }
}

function rangeTodo(
  start: string,
  end: string,
  requiredDays: number,
  checkins: string[] = [],
): Todo {
  return { ...createTodo('t', { kind: 'range', start, end, requiredDays }), checkins }
}

describe('daysBetween', () => {
  it('computes day differences', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
    expect(daysBetween('2026-01-01', '2026-01-10')).toBe(9)
    expect(daysBetween('2026-02-01', '2026-01-30')).toBe(-2)
  })
})

describe('isComplete', () => {
  it('manual done', () => {
    expect(isComplete({ ...createTodo('t'), done: true })).toBe(true)
  })

  it('range auto-completes when checkins reach requiredDays', () => {
    const t = rangeTodo('2026-07-01', '2026-07-31', 3, ['2026-07-01', '2026-07-05', '2026-07-09'])
    expect(isComplete(t)).toBe(true)
  })

  it('range incomplete below requiredDays', () => {
    const t = rangeTodo('2026-07-01', '2026-07-31', 3, ['2026-07-01'])
    expect(isComplete(t)).toBe(false)
  })
})

describe('isFailed', () => {
  it('deadline passed and not done → failed', () => {
    expect(isFailed(deadlineTodo('2026-07-26'), TODAY)).toBe(true)
  })

  it('deadline today → not failed', () => {
    expect(isFailed(deadlineTodo('2026-07-27'), TODAY)).toBe(false)
  })

  it('deadline passed but done → not failed', () => {
    expect(isFailed(deadlineTodo('2026-07-26', true), TODAY)).toBe(false)
  })

  it('range ended without enough checkins → failed', () => {
    const t = rangeTodo('2026-07-01', '2026-07-20', 5, ['2026-07-01', '2026-07-02'])
    expect(isFailed(t, TODAY)).toBe(true)
  })

  it('range ended with enough checkins → not failed (auto done)', () => {
    const t = rangeTodo('2026-07-01', '2026-07-20', 2, ['2026-07-01', '2026-07-02'])
    expect(isFailed(t, TODAY)).toBe(false)
  })

  it('nodate never fails', () => {
    expect(isFailed(createTodo('t'), TODAY)).toBe(false)
  })
})

describe('todoStatus', () => {
  it('done takes priority over failed', () => {
    expect(todoStatus(deadlineTodo('2026-07-01', true), TODAY)).toBe('done')
  })
  it('failed', () => {
    expect(todoStatus(deadlineTodo('2026-07-01'), TODAY)).toBe('failed')
  })
  it('active', () => {
    expect(todoStatus(deadlineTodo('2026-08-01'), TODAY)).toBe('active')
  })
})

describe('toggleCheckin', () => {
  it('adds and removes dates', () => {
    let t = rangeTodo('2026-07-01', '2026-07-31', 2)
    t = toggleCheckin(t, '2026-07-27')
    expect(t.checkins).toEqual(['2026-07-27'])
    t = toggleCheckin(t, '2026-07-27')
    expect(t.checkins).toEqual([])
  })

  it('no-op for non-range todos', () => {
    const t = deadlineTodo('2026-08-01')
    expect(toggleCheckin(t, '2026-07-27')).toBe(t)
  })
})

describe('toggleDone', () => {
  it('flips done flag', () => {
    const t = createTodo('t')
    expect(toggleDone(t).done).toBe(true)
    expect(toggleDone(toggleDone(t)).done).toBe(false)
  })
})

describe('groupOf', () => {
  it('nodate → nodate', () => {
    expect(groupOf(createTodo('t'), TODAY)).toBe('nodate')
  })

  it('deadline due today → today', () => {
    expect(groupOf(deadlineTodo(TODAY), TODAY)).toBe('today')
  })

  it('deadline within 7 days → upcoming', () => {
    expect(groupOf(deadlineTodo('2026-08-02'), TODAY)).toBe('upcoming')
  })

  it('deadline beyond 7 days → later', () => {
    expect(groupOf(deadlineTodo('2026-09-01'), TODAY)).toBe('later')
  })

  it('deadline passed → failed', () => {
    expect(groupOf(deadlineTodo('2026-07-01'), TODAY)).toBe('failed')
  })

  it('range covering today → today', () => {
    expect(groupOf(rangeTodo('2026-07-01', '2026-08-01', 5), TODAY)).toBe('today')
  })

  it('range starting soon → upcoming', () => {
    expect(groupOf(rangeTodo('2026-08-01', '2026-08-31', 5), TODAY)).toBe('upcoming')
  })

  it('range starting far → later', () => {
    expect(groupOf(rangeTodo('2026-12-01', '2026-12-31', 5), TODAY)).toBe('later')
  })

  it('done → done', () => {
    expect(groupOf(deadlineTodo('2026-08-01', true), TODAY)).toBe('done')
  })
})

describe('groupTodos', () => {
  it('groups in fixed order and skips empty groups', () => {
    const todos = [
      createTodo('a'), // nodate
      deadlineTodo(TODAY), // today
      deadlineTodo('2026-07-01'), // failed
    ]
    const groups = groupTodos(todos, TODAY)
    expect(groups.map((g) => g.group)).toEqual(['failed', 'today', 'nodate'])
  })

  it('returns empty array for no todos', () => {
    expect(groupTodos([], TODAY)).toEqual([])
  })
})

describe('sortInGroup', () => {
  it('sorts by relevant date then createdAt', () => {
    const a = deadlineTodo('2026-08-10')
    const b = deadlineTodo('2026-08-01')
    const c = createTodo('c')
    const sorted = sortInGroup([a, c, b])
    expect(sorted[0]).toBe(b)
    expect(sorted[1]).toBe(a)
    expect(sorted[2]).toBe(c)
  })
})

describe('validateSchedule', () => {
  it('accepts none', () => {
    expect(validateSchedule({ kind: 'none' })).toBeNull()
  })

  it('rejects empty deadline', () => {
    expect(validateSchedule({ kind: 'deadline', due: '' })).toBeTruthy()
  })

  it('rejects inverted range', () => {
    expect(
      validateSchedule({ kind: 'range', start: '2026-08-01', end: '2026-07-01', requiredDays: 1 }),
    ).toBeTruthy()
  })

  it('rejects requiredDays exceeding span', () => {
    expect(
      validateSchedule({ kind: 'range', start: '2026-07-01', end: '2026-07-10', requiredDays: 11 }),
    ).toBeTruthy()
  })

  it('accepts requiredDays equal to span', () => {
    expect(
      validateSchedule({ kind: 'range', start: '2026-07-01', end: '2026-07-10', requiredDays: 10 }),
    ).toBeNull()
  })

  it('rejects invalid requiredDays', () => {
    expect(
      validateSchedule({ kind: 'range', start: '2026-07-01', end: '2026-07-10', requiredDays: 0 }),
    ).toBeTruthy()
  })
})

describe('deadlineDayIndices', () => {
  const config = { birthdate: '2026-01-01', lifespanYears: 80, version: 1 }

  it('maps active deadline and range end to day indices', () => {
    const todos = [
      deadlineTodo('2026-01-10'), // index 9
      rangeTodo('2026-01-01', '2026-01-20', 3), // end index 19
    ]
    const set = deadlineDayIndices(todos, config, '2026-01-05')
    expect(set.has(9)).toBe(true)
    expect(set.has(19)).toBe(true)
    expect(set.size).toBe(2)
  })

  it('skips done and failed todos', () => {
    const todos = [
      deadlineTodo('2026-01-10', true), // done
      deadlineTodo('2026-01-02'), // failed (past due)
    ]
    const set = deadlineDayIndices(todos, config, '2026-01-05')
    expect(set.size).toBe(0)
  })

  it('clamps out-of-life dates', () => {
    const todos = [deadlineTodo('2200-01-01')]
    const set = deadlineDayIndices(todos, config, '2026-01-05')
    expect(set.size).toBe(0)
  })
})
