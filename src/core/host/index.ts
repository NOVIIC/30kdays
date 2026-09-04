/**
 * Extension Host 入口。
 * 已落地：扩展文件 API（fs.ts）、路径校验（paths.ts）、manifest 类型与校验、
 * 权限门控、日志、扩展上下文、内置扩展静态注册表、格子覆盖汇集（overlay.ts）。
 * 后续：逻辑 Worker 加载（manifest main）、dayEditorTools 等其余派发点（见 ARCHITECTURE.md §5）。
 */

export type { ExtensionContext, HostGrid } from './context'
export { createExtensionContext } from './context'
export type { HostFs } from './fs'
export { createHostFs } from './fs'
export type { HostLog } from './log'
export { createHostLog } from './log'
export type {
  ExtensionContributes,
  ExtensionManifest,
  OverlayContribution,
  Platform,
  ToolContribution,
  ViewContribution,
} from './manifest'
export { KNOWN_PERMISSIONS, parseManifest } from './manifest'
export type {
  DayOverlay,
  OverlayInstruction,
  OverlayLayerInfo,
  OverlayListener,
  OverlayTint,
} from './overlay'
export { OverlayHub, parseOverlayInstructions } from './overlay'
export { MAX_PATH_DEPTH, resolveExtensionPath, validateSegment } from './paths'
export { hasPermission, requirePermission } from './permissions'
export type {
  ContributedOverlay,
  ContributedTool,
  ContributedView,
  DayEditorToolProps,
  OverlayProviderModule,
  RegisteredExtension,
  ViewLoader,
} from './registry'
export { builtinExtensions, currentPlatform } from './registry'
