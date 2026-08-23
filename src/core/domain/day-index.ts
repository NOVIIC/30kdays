/**
 * DayIndex：内存 Uint8Array，每格一字节标志位，长度 = 总天数。
 * 持久化为 index.bin，首字节为格式版本头，其后为逐格标志位。
 * 扩展相关的格子提示不写入本文件，由扩展经覆盖层提供。
 */

import type { DayDoc } from './day-doc'

/** index.bin 的当前格式版本（文件首字节）。 */
export const DAY_INDEX_FORMAT_VERSION = 1

/** 标志位：该日有文字。 */
export const FLAG_TEXT = 0b01

/** 标志位：该日有图片。 */
export const FLAG_MEDIA = 0b10

/** 创建全零的 DayIndex，长度为总天数。 */
export function createDayIndex(total: number): Uint8Array {
  return new Uint8Array(total)
}

/** 置位或清除第 i 格的某个标志位。 */
export function setFlag(index: Uint8Array, i: number, flag: number, on: boolean): void {
  index[i] = on ? index[i] | flag : index[i] & ~flag
}

/** 查询第 i 格是否带有某个标志位。 */
export function hasFlag(index: Uint8Array, i: number, flag: number): boolean {
  return (index[i] & flag) !== 0
}

/** 从 DayDoc 派生标志位：正文去空白后非空置 FLAG_TEXT，有媒体附件置 FLAG_MEDIA。 */
export function flagsOfDoc(doc: DayDoc): number {
  let flags = 0
  if (doc.text.trim().length > 0) flags |= FLAG_TEXT
  if (doc.media.length > 0) flags |= FLAG_MEDIA
  return flags
}

/** 序列化为 index.bin 内容：[格式版本, ...逐格标志位]。 */
export function serializeDayIndex(index: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(index.length + 1)
  bytes[0] = DAY_INDEX_FORMAT_VERSION
  bytes.set(index, 1)
  return bytes
}

/** 解析 index.bin 内容；版本不符或长度与总天数不一致时抛错。 */
export function parseDayIndex(bytes: Uint8Array, total: number): Uint8Array {
  if (bytes.length !== total + 1) {
    throw new Error(`index.bin 长度不符：期望 ${total + 1}，实际 ${bytes.length}`)
  }
  if (bytes[0] !== DAY_INDEX_FORMAT_VERSION) {
    throw new Error(`index.bin 格式版本不符：期望 ${DAY_INDEX_FORMAT_VERSION}，实际 ${bytes[0]}`)
  }
  return bytes.slice(1)
}
