/**
 * DayDoc：按天日记文档（正文 + 媒体清单）。
 * 正文首期纯文本；结构预留富文本演进（version 字段承载后续格式升级）。
 */

/** DayDoc 的当前格式版本。 */
export const DAY_DOC_VERSION = 1

/** 日记中一条媒体附件的元信息（文件本体存于 media/<n>/<id>.webp）。 */
export type DayMedia = {
  /** 附件唯一 ID，同时是文件名主体（media/<n>/<id>.webp 与 .thumb）。 */
  id: string
  /** 原始文件名，仅作展示用途。 */
  name: string
  /** 图片宽度（像素）。 */
  w: number
  /** 图片高度（像素）。 */
  h: number
  /** MIME 类型，如 image/webp。 */
  type: string
}

/** 某一天的日记文档。 */
export type DayDoc = {
  /** 正文，首期纯文本。 */
  text: string
  /** 媒体附件清单。 */
  media: DayMedia[]
  /** 最后修改时间（毫秒时间戳）；新建未保存时为 0。 */
  updatedAt: number
  /** 文档格式版本，见 DAY_DOC_VERSION。 */
  version: number
}

/** 创建空日记文档（updatedAt 置 0，表示尚未保存过）。 */
export function createEmptyDayDoc(): DayDoc {
  return { text: '', media: [], updatedAt: 0, version: DAY_DOC_VERSION }
}
