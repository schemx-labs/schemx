import { vi } from "vite-plus/test"

/**
 * 测试宿主可触发的布局变化。
 */
interface MockSearchGeometry {
  /**
   * 更新容器尺寸并通知观察者。
   * @param width - 新的容器宽度，单位 px；省略时保持原宽度。
   */
  resize(width?: number): void
}

/**
 * 为无布局引擎的 DOM 环境提供根级搜索列的 flex 换行边界。
 * @returns 手动触发尺寸通知的方法；width 为模拟容器宽度，单位 px。
 * @example const geometry = mockSearchGeometry(); geometry.resize(400)
 */
export function mockSearchGeometry(): MockSearchGeometry {
  // 测试宿主的可用宽度。
  let width = 600

  // 已注册的尺寸观察回调。
  const callbacks = new Set<ResizeObserverCallback>()

  /**
   * 测试可主动触发的 ResizeObserver。
   */
  class TestResizeObserver implements ResizeObserver {
    /**
     * 当前实例持有的尺寸回调。
     */
    readonly callback: ResizeObserverCallback
    /**
     * 保存浏览器尺寸回调。
     * @param callback - 布局变化后需要执行的回调。
     */
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    /**
     * 注册测试观察回调。
     */
    observe(): void {
      callbacks.add(this.callback)
    }
    /**
     * 移除测试观察回调。
     */
    disconnect(): void {
      callbacks.delete(this.callback)
    }
    /**
     * 测试不需要逐个取消目标。
     */
    unobserve(): void {}
  }

  vi.stubGlobal("ResizeObserver", TestResizeObserver)
  // 回调中的 this 是本次需要读取布局的 DOM 元素。
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    // content 是本元素所属的自然内容层。
    const content = this.closest<HTMLElement>(".schemx-search-content")

    if (!content) {
      if (this.classList.contains("schemx-search-fields")) {
        // 展开时返回内层自然高度，收起时使用外层样式。
        return new DOMRect(
          0,
          0,
          width,
          Number.parseFloat(this.style.height) ||
            this.firstElementChild?.getBoundingClientRect().height ||
            0
        )
      }

      return new DOMRect()
    }

    // 在测试中用列声明的百分比模拟浏览器排列；auto 的自然宽度固定为 220px。
    const columns = Array.from(
      content.querySelectorAll<HTMLElement>(":scope > .schemx-schema-list > *")
    )

    // 当前行已使用宽度。
    let used = 0

    // 当前列所在行。
    let row = 0

    // 当前元素的模拟位置。
    let result = new DOMRect()

    // column 是按 DOM 顺序排列的根级列。
    for (const column of columns) {
      // 自动列按固有宽度布局，其余读取默认 Col 生成的百分比样式。
      // Element Plus 的栅格宽度由类名指定，内置 Col 则使用内联百分比。
      const elementSpan = column.className.match(/(?:^|\s)el-col-(\d+)(?:\s|$)/)?.[1]

      // 没有百分比样式时读取 Element Plus 的栅格类。
      const percent =
        Number.parseFloat(column.style.maxWidth) ||
        (elementSpan ? (Number(elementSpan) / 24) * 100 : 100)

      const columnWidth = column.classList.contains("schemx-col--auto")
        ? 220
        : (percent / 100) * width

      if (used > 0 && used + columnWidth > width + 0.1) {
        row += 1
        used = 0
      }

      if (column === this || column.contains(this)) {
        result = new DOMRect(used, row * 40, columnWidth, 40)
      }

      used += columnWidth
    }

    if (this === content || this === content.firstElementChild) {
      return new DOMRect(0, 0, width, columns.length ? (row + 1) * 40 : 0)
    }

    return result
  })

  /**
   * 通知全部观察者容器或内容尺寸已变化。
   * @param nextWidth - 新的容器宽度，省略时保留当前宽度。
   */
  const resize = (nextWidth = width): void => {
    width = nextWidth
    // callback 是组件注册的真实观察通知。
    callbacks.forEach((callback) => callback([], new TestResizeObserver(callback)))
  }

  return { resize }
}
