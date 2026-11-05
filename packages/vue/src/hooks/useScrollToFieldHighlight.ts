/**
 * 管理字段滚动完成后的提示及其临时 DOM 状态。
 *
 * @module hooks/useScrollToFieldHighlight
 */

import { onScopeDispose } from "vue"

import scrollIntoView from "scroll-into-view-if-needed"

import type { ScrollToFieldOptions } from "../types"
import type { CustomScrollBehaviorCallback } from "scroll-into-view-if-needed"

/**
 * 滚动库计算得到的容器与目标坐标。
 */
type FieldScrollAction = Parameters<CustomScrollBehaviorCallback>[0][number]

/**
 * 当前组件拥有的滚动提示控制器。
 */
interface UseScrollToFieldHighlightReturn {
  /**
   * 清除当前定位等待和高亮。
   */
  clear: () => void
  /**
   * 发起定位，并在选项启用时等待滚动到位后高亮。
   * @param target - 当前可见的字段外层元素。
   * @param options - 本次滚动和高亮选项。
   */
  scroll: (target: HTMLElement, options?: ScrollToFieldOptions) => void
}

/**
 * 为一个已挂载的表单管理滚动提示；卸载时清除全部临时资源。
 * @example
 * const feedback = useScrollToFieldHighlight()
 * feedback.scroll(fieldElement, { highlight: true })
 */
export function useScrollToFieldHighlight(): UseScrollToFieldHighlightReturn {
  // 最近一次定位持有的清理函数，包括监听、动画帧和高亮样式。
  let cancelCurrent: (() => void) | undefined

  /**
   * 清除上一次定位留下的临时状态，可重复调用。
   */
  const clear = (): void => {
    cancelCurrent?.()
    cancelCurrent = undefined
  }

  /**
   * 普通定位沿用滚动库的默认实现，启用高亮时观察所有实际滚动容器。
   * @param target - 注册表中找到的可见字段。
   * @param options - 本次定位的滚动方式与高亮配置。
   */
  const scroll = (target: HTMLElement, options?: ScrollToFieldOptions): void => {
    clear()

    // 默认开启定位提示；高亮配置不传给滚动库。
    const {
      highlight: highlightOptions = true,
      behavior = "smooth",
      block = "center",
      inline = "nearest",
    } = options ?? {}

    // 对齐参数在两种滚动路径中保持一致。
    const alignment = { block, inline, scrollMode: "if-needed" } as const

    if (!highlightOptions) {
      scrollIntoView(target, { ...alignment, behavior })

      return
    }

    // 0 保留持续提示；非法数值回退到默认时长。
    const requestedDuration =
      typeof highlightOptions === "object" ? highlightOptions.duration : undefined

    // 浏览器定时器使用有符号 32 位毫秒数，0 不创建结束计时器。
    let duration = 1500

    if (
      typeof requestedDuration === "number" &&
      Number.isFinite(requestedDuration) &&
      requestedDuration >= 0
    ) {
      duration = Math.min(requestedDuration, 2_147_483_647)
    }

    // 使用目标所属窗口，避免跨文档时监听和计时归属错误。
    const view = target.ownerDocument.defaultView

    if (!view) {
      scrollIntoView(target, { ...alignment, behavior })

      return
    }

    // 减少动态效果时立即定位，提示仍保持可见。
    const scrollBehavior = view.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : behavior

    // 与滚动库标准路径保持相同的 scroll-margin 修正。
    const style = view.getComputedStyle(target)

    // 非数字的 scroll-margin 按滚动库约定视为 0。
    const marginTop = Number.parseFloat(style.scrollMarginTop) || 0

    // 目标底部的滚动留白。
    const marginBottom = Number.parseFloat(style.scrollMarginBottom) || 0

    // 目标左侧的滚动留白。
    const marginLeft = Number.parseFloat(style.scrollMarginLeft) || 0

    // 目标右侧的滚动留白。
    const marginRight = Number.parseFloat(style.scrollMarginRight) || 0

    // 仅等待真正需要滚动的容器。
    let actions: FieldScrollAction[] = []

    // 连续到位的帧数，避免内外层滚动的中间状态提前触发提示。
    let settledFrames = 0

    // 仅在等待滚动到位时检查坐标的动画帧。
    let frame: number | undefined

    // 等待超时或高亮结束时释放资源。
    let timer: number | undefined

    // 高亮显示后通过 DOM 和尺寸变化检查目标，不保留动画帧循环。
    let mutationObserver: MutationObserver | undefined

    // 响应布局变化及祖先 display:none 导致的目标尺寸变化。
    let resizeObserver: ResizeObserver | undefined

    // 当前订阅属性和子节点变化的目标及其祖先。
    let observedAncestors: HTMLElement[] = []

    // 防止结束和取消路径重复恢复 DOM。
    let isCleared = false

    // 是否已将临时高亮应用到目标上。
    let isHighlighted = false

    // 保留调用方原有的内联变量及优先级。
    const previousDuration = target.style.getPropertyValue(
      "--schemx-field-highlight-duration"
    )

    // 原有持续时间变量的 CSS 优先级。
    const previousPriority = target.style.getPropertyPriority(
      "--schemx-field-highlight-duration"
    )

    /**
     * 释放本次定位的资源，并恢复调用方原有的样式。
     */
    const cleanup = (): void => {
      if (isCleared) {
        return
      }

      isCleared = true
      if (cancelCurrent === cleanup) {
        cancelCurrent = undefined
      }

      if (frame !== undefined) {
        view.cancelAnimationFrame(frame)
      }

      view.clearTimeout(timer)
      stopWaiting()
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
      view.removeEventListener("resize", checkAvailability)
      target.removeEventListener("pointerdown", cleanup, true)
      target.removeEventListener("click", cleanup, true)
      target.removeEventListener("input", cleanup, true)
      target.removeEventListener("change", cleanup, true)

      if (isHighlighted) {
        target.classList.remove(
          "schemx-field-wrapper--highlighted",
          "schemx-field-wrapper--highlight-persistent"
        )
        if (duration === 0) {
          return
        }

        if (previousDuration) {
          target.style.setProperty(
            "--schemx-field-highlight-duration",
            previousDuration,
            previousPriority
          )
        } else {
          target.style.removeProperty("--schemx-field-highlight-duration")
        }
      }
    }

    /**
     * 目标消失或隐藏后终止提示，避免异步定位留下过期状态。
     */
    const isAvailable = (): boolean => {
      // visibility 在不提供默认样式的 DOM 环境中也可能为空字符串。
      const visibility = view.getComputedStyle(target).visibility

      return (
        target.isConnected &&
        target.getClientRects().length > 0 &&
        !target.closest("[inert]") &&
        visibility !== "hidden" &&
        visibility !== "collapse"
      )
    }

    /**
     * 观察目标与祖先的显隐和挂载变化，移动到新父节点后更新订阅。
     */
    const observeAncestors = (): void => {
      // 不观察无关子树，避免输入值变化或提示样式变化产生重复检查。
      const ancestors: HTMLElement[] = []

      // 从目标向上订阅，覆盖祖先被移除、隐藏以及 Search 的 inert 状态。
      let ancestor: HTMLElement | null = target

      while (ancestor) {
        ancestors.push(ancestor)
        ancestor = ancestor.parentElement
      }

      if (
        ancestors.length === observedAncestors.length &&
        ancestors.every(
          // element 与 index 标识当前层级的祖先。
          (element, index) => element === observedAncestors[index]
        )
      ) {
        return
      }

      mutationObserver?.disconnect()
      // element 是目标本身或能影响其可见性的祖先。
      for (const element of ancestors) {
        mutationObserver?.observe(element, {
          attributes: true,
          attributeFilter: ["class", "style", "hidden", "inert"],
          childList: true,
        })
      }

      observedAncestors = ancestors
    }

    /**
     * DOM、尺寸或窗口变化后移除失效提示；不依赖无限动画帧轮询。
     */
    const checkAvailability = (): void => {
      if (isCleared) {
        return
      }

      if (!isAvailable()) {
        cleanup()

        return
      }

      observeAncestors()
    }

    /**
     * 等待阶段只响应可能触发页面滚动的按键，不把普通输入当作滚动中断。
     * @param event - 当前窗口收到的键盘事件。
     */
    const interruptScrollByKey = (event: KeyboardEvent): void => {
      // 输入控件中的方向键和空格通常用于编辑，不代表页面滚动。
      const element = event.composedPath()[0]

      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (element instanceof HTMLElement &&
          (element.isContentEditable ||
            element.closest(
              "input, textarea, select, [contenteditable]:not([contenteditable=false])"
            )))
      ) {
        return
      }

      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        cleanup()
      }
    }

    /**
     * 开始展示后移除全局滚动中断监听，区域外操作不影响已有提示。
     */
    const stopWaiting = (): void => {
      view.removeEventListener("wheel", cleanup, true)
      view.removeEventListener("touchmove", cleanup, true)
      view.removeEventListener("keydown", interruptScrollByKey, true)
    }

    /**
     * 所有容器到位后开始提示；0 持续显示，正数时长在结束时清理。
     */
    const highlight = (): void => {
      view.clearTimeout(timer)
      timer = undefined
      frame = undefined
      stopWaiting()
      if (!isAvailable()) {
        cleanup()

        return
      }

      isHighlighted = true
      if (duration === 0) {
        target.classList.add("schemx-field-wrapper--highlight-persistent")
      } else {
        target.style.setProperty("--schemx-field-highlight-duration", `${duration}ms`)
        timer = view.setTimeout(cleanup, duration)
      }

      // 连续定位同一字段时也重新启动 CSS 动画。
      void target.offsetWidth
      target.classList.add("schemx-field-wrapper--highlighted")
      mutationObserver = new MutationObserver(checkAvailability)
      resizeObserver =
        typeof ResizeObserver === "undefined"
          ? undefined
          : new ResizeObserver(checkAvailability)
      resizeObserver?.observe(target)
      observeAncestors()
      view.addEventListener("resize", checkAvailability)
    }

    /**
     * 只在全部容器连续到达计算目标后显示高亮；超时由独立定时器取消。
     */
    const checkPosition = (): void => {
      if (!isAvailable()) {
        cleanup()

        return
      }

      // action 是对应容器可达的最终坐标；允许亚像素取整误差。
      const hasArrived = actions.every(
        (action) =>
          Math.abs(action.el.scrollTop - action.top) <= 1 &&
          Math.abs(action.el.scrollLeft - action.left) <= 1
      )

      settledFrames = hasArrived ? settledFrames + 1 : 0
      if (settledFrames >= 2) {
        highlight()

        return
      }

      frame = view.requestAnimationFrame(checkPosition)
    }

    cancelCurrent = cleanup
    view.addEventListener("wheel", cleanup, { capture: true, passive: true })
    view.addEventListener("touchmove", cleanup, { capture: true, passive: true })
    view.addEventListener("keydown", interruptScrollByKey, true)
    // 区域内的点击和编辑在捕获阶段清理，不拦截原控件的事件或默认行为。
    target.addEventListener("pointerdown", cleanup, true)
    target.addEventListener("click", cleanup, true)
    target.addEventListener("input", cleanup, true)
    target.addEventListener("change", cleanup, true)
    timer = view.setTimeout(cleanup, 3000)

    try {
      scrollIntoView(target, {
        ...alignment,
        // plannedActions 包含滚动库为每个祖先容器计算的目标位置。
        behavior: (plannedActions) => {
          // 滚动库标准路径由浏览器钳制边界；这里同时保存钳制后的观察目标。
          // el 是实际滚动容器，top 和 left 是库计算的目标坐标。
          actions = plannedActions.map(({ el, top, left }) => {
            // RTL 容器的水平滚动范围从负值开始。
            const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth)

            // 当前容器是否使用从右向左的水平坐标。
            const isRtl = view.getComputedStyle(el).direction === "rtl"

            return {
              el,
              top: Math.max(
                0,
                Math.min(
                  el.scrollHeight - el.clientHeight,
                  top - marginTop + marginBottom
                )
              ),
              left: Math.max(
                isRtl ? -maxLeft : 0,
                Math.min(isRtl ? 0 : maxLeft, left - marginLeft + marginRight)
              ),
            }
          })

          for (const action of actions) {
            action.el.scroll({
              top: action.top,
              left: action.left,
              behavior: scrollBehavior,
            })
          }

          if (actions.length === 0) {
            highlight()
          } else {
            frame = view.requestAnimationFrame(checkPosition)
          }
        },
      })
    } catch (error) {
      cleanup()
      throw error
    }
  }

  onScopeDispose(clear)

  return { clear, scroll }
}
