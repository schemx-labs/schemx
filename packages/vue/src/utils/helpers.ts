import { SchemxViewSchema } from "@schemx/core"

/**
 * 判断当前项是否为顶层可见普通字段中的第一个或最后一个。
 *
 * `group` 和不可见字段不参与顶层卡片圆角判断。
 *
 * 使用示例：
 *
 * const list = [
 *   { key: 'group-1', type: 'group' },
 *   { key: 'a' },
 *   { key: 'b' },
 *   { key: 'group-2', type: 'group' },
 *   { key: 'c' },
 * ]
 *
 * getSectionPosition(list, 'a')
 * // => { found: true, isFirst: true, isLast: false }
 */
export function getSectionPosition<T extends SchemxViewSchema>(
  list: T[],
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

  const prevItem = findPositionItem(list, currentIndex, -1)
  const nextItem = findPositionItem(list, currentIndex, 1)

  return {
    found: true,
    isFirst: !prevItem,
    isLast: !nextItem,
  }
}

/**
 * 判断当前项是否参与顶层首尾样式计算。
 */
function isPositionItem<T extends SchemxViewSchema>(item?: T) {
  return (
    !!item &&
    item.componentType !== "group" &&
    (!("visible" in item) || item.visible !== false)
  )
}

function findPositionItem<T extends SchemxViewSchema>(
  list: T[],
  startIndex: number,
  step: 1 | -1
) {
  for (let index = startIndex + step; index >= 0 && index < list.length; index += step) {
    if (isPositionItem(list[index])) {
      return list[index]
    }
  }

  return undefined
}
