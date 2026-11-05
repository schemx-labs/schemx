import { computed, nextTick, ref, watch } from "vue"
import type { ComputedRef, Ref } from "vue"

import type { SchemxSearchCollapseActionConfig, SchemxSearchProps } from "../types"
import type { Values } from "@schemx/core"

/**
 * 搜索折叠状态所需的响应式配置与布局输入。
 * @typeParam TValues - 当前搜索条件类型。
 */
interface UseSearchCollapseOptions<TValues extends Values> {
  /**
   * 获取当前折叠开关或配置，后续替换和对象原地修改均可响应。
   */
  getCollapse: () => SchemxSearchProps<TValues>["collapse"]
  /**
   * DOM 实测是否存在第一行之后的内容。
   */
  hasOverflow: Readonly<Ref<boolean>>
}

/**
 * 搜索组件渲染与字段定位所需的折叠能力。
 */
interface UseSearchCollapseResult {
  /**
   * 归一化后的对象配置，供按钮读取文案。
   */
  collapseConfig: ComputedRef<SchemxSearchCollapseActionConfig>
  /**
   * 当前是否存在可折叠的后续节点。
   */
  canCollapse: ComputedRef<boolean>
  /**
   * 当前实际折叠状态；禁用折叠或只有一行时为 false。
   */
  isCollapsed: ComputedRef<boolean>
  /**
   * 用户请求的折叠状态；单行时也保留，用于稳定触发器占位文案。
   */
  requestedCollapsed: ComputedRef<boolean>
  /**
   * 反转当前状态；受控模式通过配置回调请求更新。
   */
  toggleCollapse(): void
  /**
   * 定位前请求展开；受控调用方拒绝更新时返回 false。
   */
  prepareFieldForScroll(): Promise<boolean>
}

/**
 * 管理搜索区的受控与非受控折叠，布局由已渲染内容的测量结果决定。
 * @typeParam TValues - 当前搜索条件类型。
 * @param options - 响应式折叠配置和实测溢出状态。
 * @returns 展示状态及手动切换和定位前展开的方法。
 * @example
 * const collapse = useSearchCollapse({ getCollapse: () => props.collapse, hasOverflow })
 */
export function useSearchCollapse<TValues extends Values>(
  options: UseSearchCollapseOptions<TValues>
): UseSearchCollapseResult {
  // 布尔开关使用空配置，状态和文案统一从对象配置读取。
  const collapseConfig = computed<SchemxSearchCollapseActionConfig>(() => {
    // 每次计算读取最新配置，避免捕获旧对象。
    const collapse = options.getCollapse()

    return typeof collapse === "object" ? collapse : {}
  })

  // 非受控状态只读取一次初始值。
  const internalCollapsed = ref(
    collapseConfig.value.collapsed ?? collapseConfig.value.defaultCollapsed ?? true
  )

  // 没有后续行时保留用户状态，但隐藏折叠触发器。
  const canCollapse = computed(
    () => options.getCollapse() !== false && options.hasOverflow.value
  )

  // 文案占位使用保存的状态，不能因按钮暂时隐藏而改变宽度。
  const requestedCollapsed = computed(
    () => collapseConfig.value.collapsed ?? internalCollapsed.value
  )

  // 禁用折叠后始终展示完整高度。
  const isCollapsed = computed(() => canCollapse.value && requestedCollapsed.value)

  /**
   * 更新本地状态，并向受控调用方请求同步。
   * @param collapsed - 本次期望的折叠状态。
   */
  const setCollapsed = (collapsed: boolean): void => {
    if (collapseConfig.value.collapsed === undefined) {
      internalCollapsed.value = collapsed
    }

    collapseConfig.value.onCollapsedChange?.(collapsed)
  }

  /**
   * 切换折叠状态；禁用折叠或只有一行时不处理。
   */
  const toggleCollapse = (): void => {
    if (canCollapse.value) {
      setCollapsed(!isCollapsed.value)
    }
  }

  /**
   * 定位前请求展开，并等待受控调用方更新状态。
   */
  const prepareFieldForScroll = async (): Promise<boolean> => {
    if (isCollapsed.value) {
      setCollapsed(false)
      await nextTick()
    }

    return !isCollapsed.value
  }

  // 保留最后一次受控值，撤销控制后继续使用它。
  watch(
    () => collapseConfig.value.collapsed,
    // next 和 previous 分别是本次与上次的受控折叠状态。
    (next, previous) => {
      if (next !== undefined) {
        internalCollapsed.value = next
      } else if (previous !== undefined) {
        internalCollapsed.value = previous
      }
    },
    { flush: "sync" }
  )

  return {
    collapseConfig,
    canCollapse,
    isCollapsed,
    requestedCollapsed,
    toggleCollapse,
    prepareFieldForScroll,
  }
}
