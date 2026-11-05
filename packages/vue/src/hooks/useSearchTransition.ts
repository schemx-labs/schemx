import { nextTick, onScopeDispose, watch } from "vue"
import type { ComputedRef, Ref } from "vue"

/**
 * 搜索区高度过渡所需的 DOM 与实际折叠状态。
 */
interface UseSearchTransitionOptions {
  /**
   * 包裹完整字段布局的 DOM，操作区不参与动画。
   */
  element: Ref<HTMLElement | null>
  /**
   * 自然内容测量得到的目标高度；首次完成测量前为 undefined。
   */
  height: ComputedRef<number | undefined>
}

/**
 * 在可见高度变化前读取当前高度，平滑过渡到完整内容或首行高度。
 * 动画只临时覆盖容器高度和裁剪，结束后恢复自然布局，收起高度由搜索布局持续更新。
 * @param options - 搜索区 DOM 引用与实际折叠状态。
 * @example useSearchTransition({ element: fieldsRef, height: targetHeight })
 */
export function useSearchTransition(options: UseSearchTransitionOptions): void {
  // 当前播放的动画；连续切换时先读取可见高度，再取消旧动画。
  let activeAnimation: Animation | undefined

  // 废弃快速切换或卸载前尚未完成的 nextTick 测量。
  let revision = 0

  watch(
    options.height,
    // height 是本次目标高度，previousHeight 用于跳过首次布局测量。
    async (height, previousHeight) => {
      // 本次测量所属的切换序号。
      const currentRevision = ++revision

      // pre watcher 在 Vue 替换字段前读取当前可见高度。
      const element = options.element.value

      if (!element || height === undefined || previousHeight === undefined) {
        return
      }

      // 包含未结束动画的中间高度，反向切换不会跳回旧端点。
      const startHeight = element.getBoundingClientRect().height

      activeAnimation?.cancel()
      activeAnimation = undefined

      if (
        typeof element.animate !== "function" ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        return
      }

      await nextTick()

      if (currentRevision !== revision || element !== options.element.value) {
        return
      }

      // 目标来自不受裁剪影响的自然内容层。
      const targetHeight = height

      if (startHeight === targetHeight) {
        return
      }

      // 动画期间也只裁剪内容，避免字段定位滚动到这个临时容器。
      // 不设置 fill，让高度和 overflow 在动画结束后自动回到自然布局。
      const animation = element.animate(
        [
          { height: `${startHeight}px`, overflow: "clip" },
          { height: `${targetHeight}px`, overflow: "clip" },
        ],
        { duration: 250, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
      )

      activeAnimation = animation
      animation.onfinish = () => {
        if (activeAnimation === animation) {
          activeAnimation = undefined
        }
      }
    },
    { flush: "pre" }
  )

  onScopeDispose(() => {
    revision += 1
    activeAnimation?.cancel()
    activeAnimation = undefined
  })
}
