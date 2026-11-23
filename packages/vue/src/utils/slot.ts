/**
 * 插槽解析与子插槽提取工具。
 *
 * 提供 camelCase / kebab-case 双向查找插槽，
 * 以及按字段名前缀提取子渲染器插槽。
 *
 * @module utils/slot
 */

/**
 * 检查字符串是否包含大写字母（驼峰格式特征）。
 *
 * @param str - 待检测的字符串
 * @returns 是否包含大写字母
 */
const isCamelCase = (str: string): boolean => /[A-Z]/.test(str)

/**
 * 检查字符串是否包含连字符（kebab-case 特征）。
 *
 * @param str - 待检测的字符串
 * @returns 是否包含连字符
 */
const isKebabCase = (str: string): boolean => str.includes("-")

/**
 * 将驼峰命名转换为连字符命名（kebab-case）。
 *
 * @param str - 驼峰格式的字符串
 * @returns 转换后的 kebab-case 字符串
 */
const camelToKebab = (str: string): string => {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase()
}

/**
 * 将连字符命名转换为驼峰命名（camelCase）。
 *
 * @param str - kebab-case 格式的字符串
 * @returns 转换后的 camelCase 字符串
 */
const kebabToCamel = (str: string): string => {
  return str.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())
}

/**
 * 将命名格式归一化为 kebab-case。
 *
 * @param str - 任意命名格式的字符串
 * @returns kebab-case 格式的字符串
 */
const normalizeToKebab = (str: string): string => {
  if (isCamelCase(str)) return camelToKebab(str)

  return str
}

/**
 * 将命名格式归一化为 camelCase。
 *
 * @param str - 任意命名格式的字符串
 * @returns camelCase 格式的字符串
 */
const normalizeToCamel = (str: string): string => {
  if (isKebabCase(str)) return kebabToCamel(str)

  return str
}

/**
 * 从插槽对象中按名称查找插槽，同时支持 camelCase 和 kebab-case。
 *
 * 优先查找原始名称，未找到时尝试另一种命名格式。
 * 例如传入 `userName` 时，先查 `userName`，再查 `user-name`；
 * 传入 `user-name` 时，先查 `user-name`，再查 `userName`。
 *
 * @param slots - Vue 插槽对象
 * @param name - 插槽名称（camelCase 或 kebab-case）
 *
 * @returns 匹配的插槽函数，未找到返回 undefined
 *
 * @example
 * ```typescript
 * // slots 中定义了 'user-name' 插槽
 * resolveSlot(slots, 'userName')   // => 找到 'user-name' 插槽
 * resolveSlot(slots, 'user-name')  // => 找到 'user-name' 插槽
 * ```
 */
export const resolveSlot = (
  slots: Record<string, any>,
  name: string
): ((...args: any[]) => any) | undefined => {
  if (slots[name]) return slots[name]

  const alt = isCamelCase(name)
    ? camelToKebab(name)
    : isKebabCase(name)
      ? kebabToCamel(name)
      : undefined

  if (alt && slots[alt]) return slots[alt]

  return undefined
}

/**
 * 从父级插槽中提取子渲染器插槽。
 *
 * 按 `fieldName:slotName` 和 `fieldName:slot-name` 格式匹配，
 * 提取后去掉前缀作为子渲染器的插槽名。
 * 同时支持 camelCase 和 kebab-case 的 fieldName。
 *
 * @param fieldName - 字段名
 * @param allSlots - 父级全部插槽
 *
 * @returns 子渲染器的插槽对象
 *
 * @example
 * ```typescript
 * // 父级插槽: { 'userName:prefix': fn, 'userName:suffix': fn, 'userNameLabel': fn }
 * extractChildSlots('userName', slots)
 * // => { prefix: fn, suffix: fn }
 * ```
 */
export const extractChildSlots = (
  fieldName: string,
  allSlots: Record<string, any>
): Record<string, any> => {
  const result: Record<string, any> = {}
  const camelPrefix = normalizeToCamel(String(fieldName)) + ":"
  const kebabPrefix = normalizeToKebab(String(fieldName)) + ":"

  for (const [key, value] of Object.entries(allSlots)) {
    if (key.startsWith(camelPrefix)) {
      result[key.slice(camelPrefix.length)] = value
    } else if (key.startsWith(kebabPrefix) && kebabPrefix !== camelPrefix) {
      result[key.slice(kebabPrefix.length)] = value
    }
  }

  return result
}
