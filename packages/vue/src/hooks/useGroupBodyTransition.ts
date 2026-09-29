import { computed, ref, watch } from "vue"
import type { ComputedRef } from "vue"

interface UseGroupBodyTransitionOptions {
  collapsed: ComputedRef<boolean>
  getDestroyOnCollapse: () => boolean | undefined
}

interface UseGroupBodyTransitionResult {
  showChildren: ComputedRef<boolean>
  beforeEnter: (element: Element) => void
  enter: (element: Element) => void
  afterEnter: (element: Element) => void
  beforeLeave: (element: Element) => void
  afterLeave: (element: Element) => void
}

export function useGroupBodyTransition(
  options: UseGroupBodyTransitionOptions
): UseGroupBodyTransitionResult {
  const childrenUnmounted = ref(options.collapsed.value)

  watch(
    options.collapsed,
    (isCollapsed) => {
      if (!isCollapsed) {
        childrenUnmounted.value = false
      }
    },
    { flush: "sync" }
  )

  const showChildren = computed(
    () => options.getDestroyOnCollapse() === false || !childrenUnmounted.value
  )

  const setStartHeight = (element: Element): void => {
    const body = element as HTMLElement

    body.style.setProperty(
      "--schemx-group-start-height",
      `${body.getBoundingClientRect().height}px`
    )
  }

  const enter = (element: Element): void => {
    const body = element as HTMLElement

    body.style.setProperty("--schemx-group-target-height", `${body.scrollHeight}px`)
  }

  const clearHeight = (element: Element): void => {
    const body = element as HTMLElement

    body.style.removeProperty("--schemx-group-start-height")
    body.style.removeProperty("--schemx-group-target-height")
  }

  const afterLeave = (element: Element): void => {
    clearHeight(element)

    if (options.collapsed.value && options.getDestroyOnCollapse() !== false) {
      childrenUnmounted.value = true
    }
  }

  return {
    showChildren,
    beforeEnter: setStartHeight,
    enter,
    afterEnter: clearHeight,
    beforeLeave: setStartHeight,
    afterLeave,
  }
}
