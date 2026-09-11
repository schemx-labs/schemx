/**
 * Vue 渲染层使用的 Schema 位置与 DOM key 辅助函数。
 *
 * @module utils/helpers
 */

import { isViewGroupSchema, SchemxViewSchema } from "@schemx/core"

/**
 * 判断当前项是否为顶层可见普通字段所在区段的第一个或最后一个。
 *
 * 可见 Group 是区段边界；不可见字段和不可见 Group 不参与计算。
 *
 * 使用示例：
 *
 * const list = [
 *   { key: 'group-1', children: [] },
 *   { key: 'a' },
 *   { key: 'b' },
 *   { key: 'group-2', children: [] },
 *   { key: 'c' },
 * ]
 *
 * getSectionPosition(list, 'a')
 * // => { found: true, isFirst: true, isLast: false }
 *
 * @param list - 当前层级的 ViewSchema 列表。
 * @param currentKey - 要定位的 ViewSchema key。
 * @returns 当前项是否存在以及它在所在区段中的首尾位置。
 */
export function getSectionPosition<TItem extends SchemxViewSchema>(
  list: TItem[],
  currentKey: string
) {
  const currentIndex = list.findIndex((item) => item.key === currentKey)

  if (currentIndex === -1) {
    return {
      found: false,
      isFirst: false,
      isLast: false,
    }
  }

  const currentItem = list[currentIndex]

  if (!isPositionItem(currentItem)) {
    return {
      found: true,
      isFirst: false,
      isLast: false,
    }
  }

  return {
    found: true,
    isFirst: !hasPositionItemInSection(list, currentIndex, -1),
    isLast: !hasPositionItemInSection(list, currentIndex, 1),
  }
}

/**
 * 将 NamePath 转换为整体字段与 Renderer 子插槽使用的键。
 *
 * @param name - 字符串字段名或由路径片段组成的字段名。
 * @returns 使用点号连接的稳定字段键。
 *
 * @example
 * ```ts
 * normalizeNameKey(["user", "name"]) // "user.name"
 * ```
 */
export function normalizeNameKey(name: unknown): string {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}

/**
 * 将分组 key 转换为可用于 DOM ID 的安全字符串。
 *
 * @param key - Schema 或 Group 的原始 key。
 * @returns 仅包含字母、数字、下划线和连字符的字符串。
 *
 * @example
 * ```ts
 * normalizeId("address.city") // "address-city"
 * ```
 */
export function normalizeId(key: string): string {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, "-")
}

/**
 * 判断项是否为参与区段首尾计算的可见普通字段。
 *
 * @param item - 待判断的 ViewSchema。
 * @returns 项存在、可见且不是 Group 时返回 `true`。
 */
function isPositionItem<TItem extends SchemxViewSchema>(item?: TItem) {
  return !!item && !isViewGroupSchema(item) && item.visible !== false
}

/**
 * 从当前项向指定方向查找同一区段内的可定位字段。
 *
 * @param list - 当前层级的 ViewSchema 列表。
 * @param startIndex - 当前项的索引。
 * @param step - 向前或向后查找的步长。
 * @returns 找到同一区段中的可见普通字段时返回 `true`。
 */
function hasPositionItemInSection<TItem extends SchemxViewSchema>(
  list: TItem[],
  startIndex: number,
  step: 1 | -1
): boolean {
  for (let index = startIndex + step; index >= 0 && index < list.length; index += step) {
    const item = list[index]

    if (item.visible === false) {
      continue
    }

    if (isViewGroupSchema(item)) {
      return false
    }

    if (isPositionItem(item)) {
      return true
    }
  }

  return false
}
