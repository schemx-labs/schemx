import { toNamePathSegments } from "../utils/path"

/**
 * 将行路径和相对路径拼接，保留方括号中的属性段边界。
 * @param rowPath - 当前行的完整路径。
 * @param relativePath - 行内字段或触发字段的相对路径。
 * @example joinDynamicPath("users.0", '["display.name"]') // users.0["display.name"]
 */
export function joinDynamicPath(rowPath: string, relativePath: string): string {
  if (relativePath.length === 0) {
    return rowPath
  }

  return relativePath.startsWith("[")
    ? `${rowPath}${relativePath}`
    : `${rowPath}.${relativePath}`
}

/**
 * 只重定位原行及其后代路径，保留特殊属性名，其他全表路径保持原值。
 * @param path - 已展开的字段或触发字段路径。
 * @param from - 原行的完整路径。
 * @param to - 同一行的新路径。
 * @example rebaseDynamicPath('users.0["display.name"]', "users.0", "users.1")
 */
export function rebaseDynamicPath(path: string, from: string, to: string): string {
  // 比较真实路径段，避免把属性名中的点号当成层级分隔符。
  const segments = toNamePathSegments(path)

  // 原行前缀允许点号或方括号两种写法。
  const prefix = toNamePathSegments(from)

  // segment 和 index 为原行前缀的路径段及其位置。
  if (!prefix.every((segment, index) => segments[index] === segment)) {
    return path
  }

  // current 是已生成的新路径，segment 为原字段在行内的下一段路径。
  return segments.slice(prefix.length).reduce((current, segment) => {
    // 空属性名或含路径分隔符的属性必须继续使用引号方括号语法。
    const relative =
      segment.length === 0 || /[.[\]]/.test(segment)
        ? `[${JSON.stringify(segment)}]`
        : segment

    return joinDynamicPath(current, relative)
  }, to)
}
