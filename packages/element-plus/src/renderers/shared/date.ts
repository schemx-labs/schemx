/** Element Plus 日期与时间值的只读格式化工具。 */

import dayjs from "dayjs"

/**
 * 格式化日期、时间或范围值。
 *
 * @param value - Element Plus 产生的单值或范围值。
 * @param format - Day.js 格式；字符串值会直接展示。
 * @param rangeSeparator - 范围值之间的分隔符。
 * @returns 面向用户的日期或时间文本。
 */
export function formatElementDateValue(
  value: unknown,
  format: string,
  rangeSeparator = " - "
): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => formatElementDateValue(item, format, rangeSeparator))
      .join(rangeSeparator)
  }

  if (value instanceof Date || typeof value === "number") {
    const parsed = dayjs(value)

    return parsed.isValid() ? parsed.format(format) : String(value)
  }

  return value === null || value === undefined || value === "" ? "" : String(value)
}
