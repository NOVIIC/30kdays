/**
 * 扩展文件路径的校验与解析。
 * 扩展只能持有相对路径（段数组）；Host 校验各段后拼上 ext/<ext-id>/ 前缀，
 * 得到交给存储后端的完整 StoragePath。路径以段数组而非字符串传递，
 * 没有字符串解析环节：各段独立校验、后端逐段取句柄，
 * 目录穿越（../、..\、绝对路径）在结构上不可能。
 */

import type { StoragePath } from '../storage/backend'

/** 单段最大长度（字符数）。 */
const MAX_SEGMENT_LENGTH = 128

/** 扩展相对路径的最大段数（不含 Host 拼接的 ext/<ext-id> 前缀）。 */
export const MAX_PATH_DEPTH = 8

/**
 * 段内是否含禁止字符：路径分隔符（0x2F = '/'，0x5C = Windows 反斜杠）
 * 与控制字符（0x00–0x1F）。逐字符判定，不依赖正则转义。
 */
function hasForbiddenChar(segment: string): boolean {
  for (const ch of segment) {
    const code = ch.charCodeAt(0)
    if (code === 0x2f || code === 0x5c || code <= 0x1f) return true
  }
  return false
}

/**
 * 校验单个路径段；非法时抛错。
 * 规则：非空、限长、不为 . / ..、不含分隔符与控制字符、
 * 不以点或空格结尾（Windows 兼容性）。允许中文等 Unicode 字符。
 */
export function validateSegment(segment: string): void {
  if (segment.length === 0) throw new Error('路径段不能为空')
  if (segment.length > MAX_SEGMENT_LENGTH) {
    throw new Error(`路径段过长：${segment.length} 字符（上限 ${MAX_SEGMENT_LENGTH}）`)
  }
  if (segment === '.' || segment === '..') throw new Error(`非法路径段：${segment}`)
  if (hasForbiddenChar(segment)) throw new Error(`路径段含非法字符：${segment}`)
  if (segment.endsWith('.') || segment.endsWith(' ')) {
    throw new Error(`路径段不能以点或空格结尾：${segment}`)
  }
}

/**
 * 解析扩展相对路径为存储路径：校验各段后拼上 ext/<ext-id>/ 前缀。
 * allowEmpty 为 true 时允许空路径（指向扩展文件夹自身，用于列目录）；
 * 默认要求非空（读写删必须有明确目标）。extId 同样按段规则校验。
 */
export function resolveExtensionPath(
  extId: string,
  path: string[],
  opts?: { allowEmpty?: boolean },
): StoragePath {
  validateSegment(extId)
  if (path.length === 0) {
    if (opts?.allowEmpty !== true) throw new Error('路径不能为空')
    return ['ext', extId]
  }
  if (path.length > MAX_PATH_DEPTH) {
    throw new Error(`路径层级过深：${path.length} 段（上限 ${MAX_PATH_DEPTH}）`)
  }
  for (const segment of path) validateSegment(segment)
  return ['ext', extId, ...path]
}
