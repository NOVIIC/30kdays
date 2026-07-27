export type DayColor = {
  fill: string
  border: string
  highlight: string
}

export function getDayColor(
  isPast: boolean,
  isToday: boolean,
  hasText: boolean,
  hasImage: boolean,
): DayColor {
  if (isToday) {
    return { fill: '#1e293b', border: '#60a5fa', highlight: '#93c5fd' }
  }
  if (isPast) {
    if (hasText && hasImage) {
      return { fill: '#4a5568', border: '#2d3748', highlight: '#718096' }
    }
    if (hasImage) {
      return { fill: '#3d4f5f', border: '#2d3748', highlight: '#5a6d7e' }
    }
    if (hasText) {
      return { fill: '#334155', border: '#2d3748', highlight: '#475569' }
    }
    return { fill: '#1e293b', border: '#1f2937', highlight: '#2d3748' }
  }
  return { fill: '#111827', border: '#1f2937', highlight: '#1f2937' }
}
