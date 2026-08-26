/**
 * 扩展日志（host.log.*）：统一带扩展前缀输出到控制台，便于调试溯源。
 * 无权限门槛。
 */

/** 扩展日志 API。 */
export type HostLog = {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

/** 为指定扩展创建日志门面；extId 即 manifest 的 id。 */
export function createHostLog(extId: string): HostLog {
  const prefix = `[ext:${extId}]`
  return {
    debug: (...args: unknown[]) => console.debug(prefix, ...args),
    info: (...args: unknown[]) => console.info(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  }
}
