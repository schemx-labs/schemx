/**
 * 将敏感值显示为首尾保留、中间掩码的文本。
 *
 * @param value - 待脱敏的文本。
 * @returns 脱敏后的文本。
 *
 * @example
 * ```ts
 * defaultMaskFormatter("13800138000") // => "138****8000"
 * ```
 */
export function defaultMaskFormatter(value: string): string {
  const chars = [...value]

  const length = chars.length

  if (length <= 0) return ""
  if (length <= 2) return "*".repeat(length)
  if (length <= 6) return `${chars[0]}****${chars[length - 1]}`

  return `${chars.slice(0, 3).join("")}****${chars.slice(-4).join("")}`
}
