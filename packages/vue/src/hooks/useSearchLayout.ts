import { onMounted, onScopeDispose, onUpdated, shallowRef } from "vue"
import type { Ref, ShallowRef } from "vue"

import { measureSearchLayout } from "../utils/searchLayout"

import type { SearchLayoutMeasurement } from "../utils/searchLayout"

/**
 * 观察已渲染条件的尺寸；尺寸变化不修改字段或折叠状态。
 * @param content - 保持自然高度的搜索内容层。
 * @returns 最近一次有效的布局；隐藏容器和首次挂载前为 undefined。
 * @example const layout = useSearchLayout(contentRef)
 */
export function useSearchLayout(
  content: Ref<HTMLElement | null>
): ShallowRef<SearchLayoutMeasurement | undefined> {
  // 布局只在实际变化时替换，避免测量引发连续更新。
  const layout = shallowRef<SearchLayoutMeasurement>()

  // 观察自然内容和根级列，兼顾换行与单个控件高度变化。
  let observer: ResizeObserver | undefined

  // 下一帧统一处理多条尺寸通知。
  let frame: number | undefined

  // 当前已注册观察的元素，布局状态更新无需重新订阅。
  let observed: readonly HTMLElement[] = []

  /**
   * 读取自然布局，并同步尺寸观察目标。
   */
  const measure = (): void => {
    // 当前内容层在组件卸载后可能已不存在。
    const element = content.value

    if (!element) {
      return
    }

    // next 是本次 DOM 布局，previous 用于跳过无变化的响应式更新。
    const next = measureSearchLayout(element)

    const previous = layout.value

    if (
      next?.collapsedHeight !== previous?.collapsedHeight ||
      next?.expandedHeight !== previous?.expandedHeight ||
      next?.firstRowCount !== previous?.firstRowCount ||
      next?.columns.length !== previous?.columns.length ||
      next?.columns.some(
        // column 和 index 标识本次列及其顺序，替换 Schema 后也需更新引用。
        (column, index) => column !== previous?.columns[index]
      )
    ) {
      layout.value = next
    }

    // 隐藏状态仍观察内容层，以便恢复可见时重新测量。
    const targets = [element, ...(next?.columns ?? [])]

    if (
      targets.length !== observed.length ||
      targets.some(
        // target 和 index 是当前订阅元素及其位置。
        (target, index) => target !== observed[index]
      )
    ) {
      observer?.disconnect()
      // target 是需要监听尺寸变化的内容层或根级列。
      targets.forEach((target) => observer?.observe(target))
      observed = targets
    }
  }

  /**
   * 将一批 ResizeObserver 通知合并到下一帧，避免观察回调内反复修改布局。
   */
  const scheduleMeasure = (): void => {
    if (frame !== undefined) {
      return
    }

    frame = requestAnimationFrame(() => {
      frame = undefined
      measure()
    })
  }

  onMounted(() => {
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(scheduleMeasure)
    }

    measure()
    // 不支持 ResizeObserver 时仍响应窗口缩放。
    window.addEventListener("resize", scheduleMeasure)
  })

  // Schema 增删、显隐或布局配置更新后读取最新根级列。
  onUpdated(measure)

  onScopeDispose(() => {
    observer?.disconnect()
    window.removeEventListener("resize", scheduleMeasure)
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
    }
  })

  return layout
}
