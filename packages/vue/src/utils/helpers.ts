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

/** 将 NamePath 转换为整体字段与 Renderer 子插槽使用的键。 */
export function normalizeNameKey(name: unknown): string {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}

/** 将分组 key 转换为可用于 DOM ID 的安全字符串。 */
export function normalizeId(key: string): string {
  return String(key).replace(/[^a-zA-Z0-9_-]/g, "-")
}

function isPositionItem<TItem extends SchemxViewSchema>(item?: TItem) {
  return !!item && !isViewGroupSchema(item) && item.visible !== false
}

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
