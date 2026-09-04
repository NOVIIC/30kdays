/**
 * 待办的格子覆盖 provider（gridOverlays 派发点）。
 * 把未完成待办的截止日 / 区间结束日映射为声明式指令：已过期标警示红、
 * 今天标强调橙（强）、未来标强调橙（弱）；已完成与无日期不标记。
 * 指令以日期寻址，日索引换算由 Host 完成；推模型整层替换，待办变化即重推。
 */

import type { ExtensionContext, OverlayInstruction } from '../../../src/core/host'
import { localISODate } from '../../../src/core/domain/life'
import { loadTodos, todos } from './store'
import type { Todo } from './todos'

/** 过期（未达成）标记色：警示红。 */
export const COLOR_FAILED = '#b5462f'

/** 截止/区间结束标记色：主题强调橙（与 GridColors.today 同源）。 */
export const COLOR_ACCENT = '#c2611e'

/** 由待办列表计算覆盖指令（纯函数，便于测试）。 */
export function computeOverlays(list: Todo[], today: string): OverlayInstruction[] {
  const result: OverlayInstruction[] = []
  for (const t of list) {
    if (t.done) continue
    const s = t.schedule
    const date = s.kind === 'deadline' ? s.due : s.kind === 'range' ? s.end : null
    if (date === null) continue
    if (date < today) {
      result.push({
        date,
        tint: { color: COLOR_FAILED, intensity: 0.9 },
        dot: { color: COLOR_FAILED },
      })
    } else if (date === today) {
      result.push({
        date,
        tint: { color: COLOR_ACCENT, intensity: 0.8 },
        dot: { color: COLOR_ACCENT },
      })
    } else {
      result.push({
        date,
        tint: { color: COLOR_ACCENT, intensity: 0.3 },
        dot: { color: COLOR_ACCENT },
      })
    }
  }
  return result
}

/** 启动覆盖推送：载入待办并订阅变化；返回清理函数（退订并清除本层）。 */
export function start(ctx: ExtensionContext): () => void {
  void loadTodos(ctx)
  const unsub = todos.subscribe((list) => {
    if (list === null) return
    void ctx.grid.setOverlays('schedule', computeOverlays(list, localISODate(new Date())))
  })
  return () => {
    unsub()
    void ctx.grid.setOverlays('schedule', [])
  }
}
