/**
 * 人生日历网格配色。
 * 浅色：纸张感，写过日记的日子是"墨"，未来的日子近乎空白。
 * 深色：墨色反转，内容日子发"光"。
 */
export type GridColors = {
  /** 画布背景（与页面背景一致，网格由此"留白"） */
  bg: string
  /** 未来的日子 */
  future: string
  /** 空白过去 */
  pastEmpty: string
  /** 写过日记的过去 */
  pastContent: string
  /** 今天 */
  today: string
  /** 强调色：今天描边、todo 截止日标记点 */
  accent: string
}

export const lightGridColors: GridColors = {
  bg: '#f7f5f0',
  future: '#e9e6de',
  pastEmpty: '#d3cec2',
  pastContent: '#6e6656',
  today: '#bc4b26',
  accent: '#bc4b26',
}

export const darkGridColors: GridColors = {
  bg: '#191817',
  future: '#242220',
  pastEmpty: '#3b3831',
  pastContent: '#cfc5b0',
  today: '#e0784f',
  accent: '#e0784f',
}

export type DayState = {
  isPast: boolean
  isToday: boolean
  hasContent: boolean
}

export function dayFill(colors: GridColors, s: DayState): string {
  if (s.isToday) return colors.today
  if (s.isPast) return s.hasContent ? colors.pastContent : colors.pastEmpty
  return colors.future
}
