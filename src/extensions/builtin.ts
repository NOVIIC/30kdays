/**
 * 内置扩展清单。
 *
 * PWA 壳不能扫文件系统，内置扩展靠这份硬编码清单发现。
 * 阶段 1 第二步接入 memo 时在此追加。
 */
export interface BuiltinExtension {
  id: string
  /** manifest.json 的 URL（构建产物路径） */
  manifestUrl: string
}

export const builtinExtensions: BuiltinExtension[] = [
  // { id: 'memo', manifestUrl: '/extensions/memo/manifest.json' },
]
