/**
 * 搜索条件区的实测布局；只统计根级布局节点，不遍历分组内部。
 */
export interface SearchLayoutMeasurement {
  /**
   * 当前参与布局的根级列。
   */
  columns: readonly HTMLElement[]
  /**
   * 第一行包含的连续列数。
   */
  firstRowCount: number
  /**
   * 收起时保留的实际高度，单位 px。
   */
  collapsedHeight: number
  /**
   * 完整内容的自然高度，单位 px。
   */
  expandedHeight: number
}

/**
 * 测量已挂载条件的第一行和完整高度，不修改 DOM 或 Schema。
 * @param content - 不受折叠高度限制的内容容器，直接包含根级 SchemaList。
 * @returns 实测布局；容器尚不可见时返回 undefined，等待后续尺寸通知。
 * @example const layout = measureSearchLayout(contentElement)
 */
export function measureSearchLayout(
  content: HTMLElement
): SearchLayoutMeasurement | undefined {
  // 独立内容层保持自然高度，外部折叠与动画不会改变测量值。
  const contentRect = content.getBoundingClientRect()

  if (contentRect.width <= 0) {
    return undefined
  }

  // 只读取第一层列，嵌套分组作为一个整体参与外层换行。
  const columns = Array.from(
    content.querySelectorAll<HTMLElement>(":scope > .schemx-schema-list > *")
  ).filter(
    // column 是当前根级列；display:none 的节点不参与行高计算。
    (column) => column.getBoundingClientRect().height > 0
  )

  // 包含根级分组的外边距，避免收起时截掉首行底部间距。
  const rects = columns.map(
    // column 是参与本次测量的根级列。
    (column) => {
      // 元素边界不含外边距，需补入 flex 行占用的实际范围。
      const rect = column.getBoundingClientRect()

      // 读取根级列或无 Col 包装的 Group 的外边距。
      const style = getComputedStyle(column)

      return {
        top: rect.top - (Number.parseFloat(style.marginTop) || 0),
        bottom: rect.bottom + (Number.parseFloat(style.marginBottom) || 0),
      }
    }
  )

  // 首行列的垂直公共区间，可兼容 align:center/bottom 和不同高度。
  let overlapTop = -Infinity

  let overlapBottom = Infinity

  // 首行所有列的最下边界。
  let firstRowBottom = contentRect.top

  // 连续属于首行的列数。
  let firstRowCount = 0

  // rect 是当前列的实际边界。
  for (const rect of rects) {
    if (
      firstRowCount > 0 &&
      (rect.top >= overlapBottom - 0.5 || rect.bottom <= overlapTop + 0.5)
    ) {
      break
    }

    overlapTop = Math.max(overlapTop, rect.top)
    overlapBottom = Math.min(overlapBottom, rect.bottom)
    firstRowBottom = Math.max(firstRowBottom, rect.bottom)
    firstRowCount += 1
  }

  // Row 的负下边距抵消半个 gutter；收起高度与完整布局保持相同边界。
  const row = content.firstElementChild

  // 自定义 Row 未设置下边距时按 0 处理。
  const marginBottom = row
    ? Number.parseFloat(getComputedStyle(row).marginBottom) || 0
    : 0

  // 第一行不存在时不保留额外高度。
  const collapsedHeight =
    firstRowCount > 0 ? Math.max(0, firstRowBottom - contentRect.top + marginBottom) : 0

  return {
    columns,
    firstRowCount,
    collapsedHeight: Math.min(collapsedHeight, contentRect.height),
    expandedHeight: contentRect.height,
  }
}
