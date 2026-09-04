/**
 * 待办扩展的领域模型与纯函数。
 * 数据形态：一待办一文件 ext/todo/todos/<id>.json（与 memo 同模式，同步按文件粒度合并）。
 * 完成语义：统一 done 标志（三种类型都可手动勾选；区间型打卡达标自动置完成）；
 * 「未达成」与分组由 schedule + done 实时派生，不入库。
 * 日期一律为 YYYY-MM-DD（本地日历日语义），比较直接用字符串序（ISO 格式字典序即日期序）。
 */

import { formatISODate, parseISODate } from '../../../src/core/domain/life'

/** 待办文档格式版本（写入时携带，演进时按版本迁移）。 */
export const TODO_FORMAT_VERSION = 1

/** 一天的毫秒数（UTC 下每天恒为 86400 秒，无夏令时）。 */
const MS_PER_DAY = 86_400_000

/** 调度类型：无日期 / 截止日 / 区间打卡。 */
export type TodoSchedule =
  | { kind: 'none' }
  | { kind: 'deadline'; due: string }
  | { kind: 'range'; start: string; end: string; requiredDays: number }

/** 一条待办：对应 ext/todo/todos/<id>.json 的文件内容。 */
export type Todo = {
  /** 主键（crypto.randomUUID()），即文件名。 */
  id: string
  /** 纯文本正文。 */
  text: string
  /** 调度。 */
  schedule: TodoSchedule
  /** 区间型打卡记录（YYYY-MM-DD，升序去重）；非区间型恒为空数组。 */
  checkIns: string[]
  /** 完成标志；区间型达标时由 checkIn 自动置位。 */
  done: boolean
  /** 创建时间（Unix 毫秒）。 */
  createdAt: number
  /** 最后修改时间（Unix 毫秒）。 */
  updatedAt: number
  /** 格式版本，见 TODO_FORMAT_VERSION。 */
  version: number
}

/** 分组：未达成 / 今日 / 近 7 日 / 之后 / 无日期 / 已完成。 */
export type TodoGroup = 'failed' | 'today' | 'week' | 'later' | 'none' | 'done'

/** 组的显示顺序。 */
export const GROUP_ORDER: readonly TodoGroup[] = [
  'failed',
  'today',
  'week',
  'later',
  'none',
  'done',
]

/** 组的显示名。 */
export const GROUP_LABELS: Record<TodoGroup, string> = {
  failed: '未达成',
  today: '今日',
  week: '近 7 日',
  later: '之后',
  none: '无日期',
  done: '已完成',
}

/** 待办文件在扩展作用域内的相对路径（段数组，经 Host 校验后拼 ext/todo/ 前缀）。 */
export function todoPath(id: string): string[] {
  return ['todos', `${id}.json`]
}

/** 新建一条空待办（默认无日期）。 */
export function createTodo(id: string, now: number): Todo {
  return {
    id,
    text: '',
    schedule: { kind: 'none' },
    checkIns: [],
    done: false,
    createdAt: now,
    updatedAt: now,
    version: TODO_FORMAT_VERSION,
  }
}

/** YYYY-MM-DD 合法性校验（格式正确且日期真实存在）。 */
function isISODate(date: unknown): date is string {
  if (typeof date !== 'string') return false
  try {
    parseISODate(date)
    return true
  } catch {
    return false
  }
}

/** 日期加 n 天（UTC 算术）。 */
export function addDays(date: string, n: number): string {
  return formatISODate(parseISODate(date) + n * MS_PER_DAY)
}

/** 区间天数（含两端）；要求 start ≤ end。 */
export function spanDays(start: string, end: string): number {
  return (parseISODate(end) - parseISODate(start)) / MS_PER_DAY + 1
}

/** 解析并校验调度；非法返回 null。区间型要求 start ≤ end 且 requiredDays ≥ 1。 */
function parseSchedule(raw: unknown): TodoSchedule | null {
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Record<string, unknown>
  if (s.kind === 'none') return { kind: 'none' }
  if (s.kind === 'deadline') {
    if (!isISODate(s.due)) return null
    return { kind: 'deadline', due: s.due }
  }
  if (s.kind === 'range') {
    if (!isISODate(s.start) || !isISODate(s.end)) return null
    if (s.start > s.end) return null
    if (!Number.isInteger(s.requiredDays) || (s.requiredDays as number) < 1) return null
    return { kind: 'range', start: s.start, end: s.end, requiredDays: s.requiredDays as number }
  }
  return null
}

/** 解析并校验打卡记录：合法日期数组、去重、升序；非区间型归一化为空数组。 */
function parseCheckIns(raw: unknown, kind: TodoSchedule['kind']): string[] | null {
  if (!Array.isArray(raw)) return null
  if (kind !== 'range') return []
  if (!raw.every(isISODate)) return null
  const unique = [...new Set(raw)].sort()
  return unique
}

/** 解析并校验待办文档；字段缺失或类型不符返回 null（视为损坏，载入时跳过）。 */
export function parseTodo(raw: unknown): Todo | null {
  if (typeof raw !== 'object' || raw === null) return null
  const t = raw as Record<string, unknown>
  if (typeof t.id !== 'string' || t.id === '') return null
  if (typeof t.text !== 'string') return null
  if (typeof t.done !== 'boolean') return null
  if (typeof t.createdAt !== 'number' || !Number.isFinite(t.createdAt)) return null
  if (typeof t.updatedAt !== 'number' || !Number.isFinite(t.updatedAt)) return null
  const schedule = parseSchedule(t.schedule)
  if (schedule === null) return null
  const checkIns = parseCheckIns(t.checkIns, schedule.kind)
  if (checkIns === null) return null
  return {
    id: t.id,
    text: t.text,
    schedule,
    checkIns,
    done: t.done,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    version: TODO_FORMAT_VERSION,
  }
}

/** 更换调度；切出区间型时清空打卡记录（保持规范形态）。 */
export function withSchedule(todo: Todo, schedule: TodoSchedule, now: number): Todo {
  return {
    ...todo,
    schedule,
    checkIns: schedule.kind === 'range' ? todo.checkIns : [],
    updatedAt: now,
  }
}

/** 勾选/取消完成。 */
export function setDone(todo: Todo, done: boolean, now: number): Todo {
  if (todo.done === done) return todo
  return { ...todo, done, updatedAt: now }
}

/**
 * 区间型打卡：日期落在区间内且未打过才生效；
 * 打卡数达到 requiredDays 时自动置完成。其它情况原样返回。
 */
export function checkIn(todo: Todo, date: string, now: number): Todo {
  const s = todo.schedule
  if (s.kind !== 'range') return todo
  if (date < s.start || date > s.end) return todo
  if (todo.checkIns.includes(date)) return todo
  const checkIns = [...todo.checkIns, date].sort()
  const done = todo.done || checkIns.length >= s.requiredDays
  return { ...todo, checkIns, done, updatedAt: now }
}

/**
 * 分组判定（today 为本地日历日 YYYY-MM-DD）：
 * 已完成优先；之后按调度看：过期未完成 → 未达成；截止日为今天或区间覆盖今天 → 今日；
 * 相关日期在 (today, today+7] → 近 7 日；更远 → 之后；无日期兜底。
 */
export function groupOf(todo: Todo, today: string): TodoGroup {
  if (todo.done) return 'done'
  const s = todo.schedule
  if (s.kind === 'none') return 'none'
  const weekEnd = addDays(today, 7)
  if (s.kind === 'deadline') {
    if (s.due < today) return 'failed'
    if (s.due === today) return 'today'
    return s.due <= weekEnd ? 'week' : 'later'
  }
  if (s.end < today) return 'failed'
  if (s.start <= today) return 'today'
  return s.start <= weekEnd ? 'week' : 'later'
}

/**
 * 组内排序的相关日期：deadline 取 due；range 未开始取 start、进行中/已过期取 end；
 * 无日期返回 null（「无日期」「已完成」组不按此排序）。
 */
export function relevantDate(todo: Todo, today: string): string | null {
  const s = todo.schedule
  if (s.kind === 'none') return null
  if (s.kind === 'deadline') return s.due
  return today < s.start ? s.start : s.end
}

/** updatedAt 倒序（刚改的在前），相同则按 id 保证稳定。 */
function compareByUpdated(a: Todo, b: Todo): number {
  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * 组内比较器：「无日期」「已完成」按 updatedAt 倒序；
 * 其余组按相关日期升序（最紧迫的在前），日期相同按 updatedAt 倒序。
 */
export function compareInGroup(group: TodoGroup, today: string): (a: Todo, b: Todo) => number {
  if (group === 'none' || group === 'done') return compareByUpdated
  return (a, b) => {
    const da = relevantDate(a, today)
    const db = relevantDate(b, today)
    if (da !== db) {
      if (da === null) return 1
      if (db === null) return -1
      return da < db ? -1 : 1
    }
    return compareByUpdated(a, b)
  }
}

/**
 * 与某天相关的待办（日记弹层工具用）：截止日恰为该天，或区间覆盖该天；
 * 无日期型恒不相关。返回时未完成在前（保持传入顺序）、已完成沉底。
 */
export function todosForDate(list: Todo[], date: string): Todo[] {
  const relevant = list.filter((t) => {
    const s = t.schedule
    if (s.kind === 'deadline') return s.due === date
    if (s.kind === 'range') return s.start <= date && date <= s.end
    return false
  })
  return [...relevant.filter((t) => !t.done), ...relevant.filter((t) => t.done)]
}

/**
 * 格式化日期展示：当年省略年份（M月D日），跨年带年份。now 可注入以便测试。
 */
export function formatDateCN(date: string, now: Date = new Date()): string {
  const d = new Date(parseISODate(date))
  const md = `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
  return d.getUTCFullYear() === now.getFullYear() ? md : `${d.getUTCFullYear()}年${md}`
}

/** 调度标签文案：「无日期」「截止 M月D日」「M月D日 ~ M月D日 · 打卡 n/m」。 */
export function scheduleLabel(todo: Todo, now: Date = new Date()): string {
  const s = todo.schedule
  if (s.kind === 'none') return '无日期'
  if (s.kind === 'deadline') return `截止 ${formatDateCN(s.due, now)}`
  return `${formatDateCN(s.start, now)} ~ ${formatDateCN(s.end, now)} · 打卡 ${todo.checkIns.length}/${s.requiredDays}`
}
