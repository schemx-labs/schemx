import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { measureSearchLayout } from "../utils/searchLayout"

/**
 * 构建具有指定列边界的自然内容层。
 * @param rects - 根级列的真实位置和高度；允许不同高度或垂直对齐。
 * @param height - 内容层的完整自然高度。
 */
function contentWithRects(rects: DOMRect[], height = 100): HTMLElement {
  // 外层只包含一个根级 Row，嵌套列由测试另行添加。
  const content = document.createElement("div")

  // 模拟 UI Row 的 gutter 负边距。
  const row = document.createElement("div")

  document.body.append(content)
  row.className = "schemx-schema-list"
  content.append(row)
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 10, 600, height)
  )
  // rect 是当前列的实测边界。
  rects.forEach((rect) => {
    // 根级列保留真实 DOM 层级，测量函数通过选择器获取它。
    const column = document.createElement("div")

    column.className = "schemx-col"
    row.append(column)
    vi.spyOn(column, "getBoundingClientRect").mockReturnValue(rect)
  })

  return content
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe("Search 实测布局", () => {
  it("不同高度且垂直居中的列属于同一行，取整行最大下边界", () => {
    // 第二列较矮，顶边不同但与第一列共享同一 flex 行。
    const content = contentWithRects([
      new DOMRect(0, 10, 220, 60),
      new DOMRect(220, 30, 220, 20),
      new DOMRect(0, 70, 220, 40),
    ])

    expect(measureSearchLayout(content)).toMatchObject({
      firstRowCount: 2,
      collapsedHeight: 60,
      expandedHeight: 100,
    })
  })

  it("抵消 Row 的负下边距，不统计嵌套列", () => {
    // 单个 Group 占据首行，内部列不参与外层行数。
    const content = contentWithRects([
      new DOMRect(0, 10, 600, 60),
      new DOMRect(0, 70, 600, 40),
    ])

    content.firstElementChild?.setAttribute("style", "margin-bottom: -5px")
    content
      .querySelector(".schemx-col")
      ?.insertAdjacentHTML("beforeend", '<div class="schemx-col"></div>')
    expect(measureSearchLayout(content)).toMatchObject({
      firstRowCount: 1,
      collapsedHeight: 55,
    })
    expect(measureSearchLayout(content)?.columns).toHaveLength(2)
  })

  it("空列表高度为零，隐藏容器等待后续测量", () => {
    // 不可见容器不能用零尺寸覆盖已知布局。
    const content = contentWithRects([], 0)

    expect(measureSearchLayout(content)).toMatchObject({
      firstRowCount: 0,
      collapsedHeight: 0,
      expandedHeight: 0,
    })
    vi.spyOn(content, "getBoundingClientRect").mockReturnValue(new DOMRect())
    expect(measureSearchLayout(content)).toBeUndefined()
  })
})
