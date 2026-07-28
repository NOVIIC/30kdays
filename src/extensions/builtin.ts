/**
 * 内置扩展清单。
 *
 * PWA 壳不能扫文件系统，内置扩展靠这份硬编码清单发现。
 * 路径是构建产物/dev server 服务的 URL（相对站点根）。
 */
export interface BuiltinExtension {
  id: string
  /** manifest.json 的 URL（构建产物路径） */
  manifestUrl: string
}

export const builtinExtensions: BuiltinExtension[] = [
  { id: 'memo', manifestUrl: '/extensions/memo/manifest.json' },
]
