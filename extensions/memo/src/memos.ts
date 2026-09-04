/**
 * 备忘扩展的领域模型与纯函数。
 * 数据形态：一备忘一文件 ext/memo/memos/<id>.json（与核心 days/<n>.json 同模式，
 * 同步阶段可按文件粒度合并）；列表按 updatedAt 倒序，排序在载入后内存中进行。
 */

/** 备忘文档格式版本（写入时携带，演进时按版本迁移）。 */
export const MEMO_FORMAT_VERSION = 1

/** 一条备忘：对应 ext/memo/memos/<id>.json 的文件内容。 */
export type Memo = {
  /** 主键（crypto.randomUUID()），即文件名。 */
  id: string
  /** 纯文本正文。 */
  text: string
  /** 最后修改时间（Unix 毫秒），排序依据。 */
  updatedAt: number
  /** 格式版本，见 MEMO_FORMAT_VERSION。 */
  version: number
}

/** 备忘文件在扩展作用域内的相对路径（段数组，经 Host 校验后拼 ext/memo/ 前缀）。 */
export function memoPath(id: string): string[] {
  return ['memos', `${id}.json`]
}

/** 新建一条空备忘。 */
export function createMemo(id: string, now: number): Memo {
  return { id, text: '', updatedAt: now, version: MEMO_FORMAT_VERSION }
}

/** 解析并校验备忘文档；字段缺失或类型不符返回 null（视为损坏，载入时跳过）。 */
export function parseMemo(raw: unknown): Memo | null {
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>
  if (typeof m.id !== 'string' || m.id === '') return null
  if (typeof m.text !== 'string') return null
  if (typeof m.updatedAt !== 'number' || !Number.isFinite(m.updatedAt)) return null
  return { id: m.id, text: m.text, updatedAt: m.updatedAt, version: MEMO_FORMAT_VERSION }
}

/** 列表排序：updatedAt 倒序（刚改的在前），相同则按 id 保证稳定。 */
export function compareMemos(a: Memo, b: Memo): number {
  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * 格式化更新时间的展示文案：当年省略年份（M月D日 HH:mm），跨年带年份。
 * now 可注入以便测试。
 */
export function formatMemoTime(ts: number, now: Date = new Date()): string {
  const d = new Date(ts)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  return d.getFullYear() === now.getFullYear() ? `${md} ${hm}` : `${d.getFullYear()}年${md} ${hm}`
}
