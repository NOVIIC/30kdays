import { indexOf, totalDays, type LifeConfig } from './lifeConfig'

/**
 * Todo 调度类型：
 * - none：无日期（普通待办）
 * - deadline：截止日，在某天之前完成
 * - range：日期区间 + 所需天数，区间内任意日期可打卡，
 *   打卡数达到所需天数即完成
 */
export type TodoSchedule =
  | { kind: 'none' }
  | { kind: 'deadline'; due: string }
  | { kind: 'range'; start: string; end: string; requiredDays: number }

export type Todo = {
  id: string
  title: string
  schedule: TodoSchedule
  /** 区间型已打卡的日期（YYYY-MM-DD） */
  checkins: string[]
  /** 手动标记完成 */
  done: boolean
  createdAt: number
}

export type TodoStatus = 'active' | 'done' | 'failed'

export type TodoGroup = 'failed' | 'today' | 'upcoming' | 'later' | 'nodate' | 'done'

export const GROUP_ORDER: TodoGroup[] = ['failed', 'today', 'upcoming', 'later', 'nodate', 'done']

export const UPCOMING_DAYS = 7

const MS_PER_DAY = 86_400_000

/** b - a 的天数差（日期字符串均为 YYYY-MM-DD） */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / MS_PER_DAY)
}

/** 本地今天，YYYY-MM-DD */
export function todayString(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 今天起第 n 天的日期，YYYY-MM-DD */
export function offsetDateString(days: number, now: Date = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return todayString(d)
}

export function createTodo(title: string, schedule: TodoSchedule = { kind: 'none' }): Todo {
  return {
    id: crypto.randomUUID(),
    title,
    schedule,
    checkins: [],
    done: false,
    createdAt: Date.now(),
  }
}

/** 是否完成：手动完成，或区间打卡数达标 */
export function isComplete(t: Todo): boolean {
  if (t.done) return true
  if (t.schedule.kind === 'range') {
    return t.checkins.length >= t.schedule.requiredDays
  }
  return false
}

/** 是否已过期未达成：截止日/结束日已过且未完成 */
export function isFailed(t: Todo, today: string): boolean {
  if (isComplete(t)) return false
  const s = t.schedule
  if (s.kind === 'deadline') return s.due < today
  if (s.kind === 'range') return s.end < today
  return false
}

export function todoStatus(t: Todo, today: string): TodoStatus {
  if (isComplete(t)) return 'done'
  if (isFailed(t, today)) return 'failed'
  return 'active'
}

/** 区间打卡：切换某天的打卡状态 */
export function toggleCheckin(t: Todo, date: string): Todo {
  if (t.schedule.kind !== 'range') return t
  const has = t.checkins.includes(date)
  const checkins = has ? t.checkins.filter((d) => d !== date) : [...t.checkins, date]
  return { ...t, checkins }
}

export function toggleDone(t: Todo): Todo {
  return { ...t, done: !t.done }
}

export function groupOf(t: Todo, today: string): TodoGroup {
  const status = todoStatus(t, today)
  if (status === 'done') return 'done'
  if (status === 'failed') return 'failed'
  const s = t.schedule
  if (s.kind === 'none') return 'nodate'
  if (s.kind === 'deadline') {
    if (s.due === today) return 'today'
    return daysBetween(today, s.due) <= UPCOMING_DAYS ? 'upcoming' : 'later'
  }
  // range：今天在区间内 → 今日；区间未开始按起始日归类
  if (s.start <= today && today <= s.end) return 'today'
  return daysBetween(today, s.start) <= UPCOMING_DAYS ? 'upcoming' : 'later'
}

function relevantDate(t: Todo): string {
  const s = t.schedule
  if (s.kind === 'deadline') return s.due
  if (s.kind === 'range') return s.start
  return '￿' // 无日期的排到最后
}

export function sortInGroup(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const d = relevantDate(a).localeCompare(relevantDate(b))
    if (d !== 0) return d
    return a.createdAt - b.createdAt
  })
}

/** 按组归类并排序，空组不返回 */
export function groupTodos(todos: Todo[], today: string): { group: TodoGroup; items: Todo[] }[] {
  const map = new Map<TodoGroup, Todo[]>()
  for (const t of todos) {
    const g = groupOf(t, today)
    const arr = map.get(g)
    if (arr) arr.push(t)
    else map.set(g, [t])
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
    group: g,
    items: sortInGroup(map.get(g)!),
  }))
}

/** 校验调度设置的合法性，返回错误信息或 null */
export function validateSchedule(s: TodoSchedule): string | null {
  if (s.kind === 'deadline') {
    if (!s.due) return '请选择截止日期'
  } else if (s.kind === 'range') {
    if (!s.start || !s.end) return '请选择起止日期'
    if (s.end < s.start) return '结束日不能早于起始日'
    if (!Number.isInteger(s.requiredDays) || s.requiredDays < 1) return '所需天数至少为 1'
    const span = daysBetween(s.start, s.end) + 1
    if (span < s.requiredDays) return `区间共 ${span} 天，少于所需天数 ${s.requiredDays} 天`
  }
  return null
}

/**
 * 日历上需要画标记点的人生日索引集合：
 * 进行中的截止日（deadline.due）与区间结束日（range.end）。
 */
export function deadlineDayIndices(todos: Todo[], config: LifeConfig, today: string): Set<number> {
  const set = new Set<number>()
  const total = totalDays(config)
  for (const t of todos) {
    if (todoStatus(t, today) !== 'active') continue
    const s = t.schedule
    const dateStr = s.kind === 'deadline' ? s.due : s.kind === 'range' ? s.end : null
    if (!dateStr) continue
    const idx = indexOf(new Date(dateStr + 'T00:00:00Z'), config)
    if (idx >= 0 && idx < total) set.add(idx)
  }
  return set
}
