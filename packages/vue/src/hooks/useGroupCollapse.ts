/**
 * 管理 Group 折叠状态及 scrollToField 使用的展开控制器。
 *
 * @module hooks/useGroupCollapse
 */

import { computed, nextTick, ref, watch } from "vue"
import type { ComputedRef } from "vue"

import {
  appendGroupScrollPath,
  provideGroupScrollPath,
  useFieldScrollRegistry,
  useGroupScrollPath,
} from "../context/fieldScrollContext"

import type { SchemxViewGroupSchema } from "@schemx/core"

/** 初始化 Group 折叠控制所需的响应式 Schema getter。 */
interface UseGroupCollapseOptions {
  /** 获取当前 Group 的 ViewSchema。 */
  getSchema: () => SchemxViewGroupSchema
}

/** Group 提供给渲染逻辑的折叠状态与手动切换动作。 */
interface UseGroupCollapseResult {
  /** 当前是否折叠，包含 scrollToField 展开后的展示状态。 */
  collapsed: ComputedRef<boolean>
  /** 切换非受控折叠状态并通知 Schema 回调。 */
  toggle: () => void
}

/**
 * 组合 Group 的受控/非受控折叠状态与滚动展开注册。
 *
 * @param options - 当前 Group ViewSchema 的 getter。
 * @returns Group 当前折叠状态和手动切换方法。
 *
 * @example
 * ```ts
 * const { collapsed, toggle } = useGroupCollapse({ getSchema: () => props.schema })
 * ```
 */
export function useGroupCollapse(
  options: UseGroupCollapseOptions
): UseGroupCollapseResult {
  const fieldScrollRegistry = useFieldScrollRegistry()

  const groupPath = appendGroupScrollPath(useGroupScrollPath(), options.getSchema().key)

  provideGroupScrollPath(groupPath)

  const internalCollapsed = ref(Boolean(options.getSchema().defaultCollapsed))

  const scrollExpanded = ref(false)

  const collapsed = computed(() =>
    scrollExpanded.value
      ? false
      : (options.getSchema().collapsed ?? internalCollapsed.value)
  )

  const requestExpandForScroll = async (): Promise<boolean> => {
    const schema = options.getSchema()

    if (!collapsed.value) {
      return true
    }

    if (!schema.collapsible || schema.disabled) {
      return false
    }

    if (schema.collapsed === undefined) {
      internalCollapsed.value = false
      schema.onCollapsedChange?.(false)

      return true
    }

    schema.onCollapsedChange?.(false)

    if (!fieldScrollRegistry) {
      return false
    }

    await nextTick()

    if (fieldScrollRegistry.getGroupCollapsed(groupPath) !== false) {
      return false
    }

    scrollExpanded.value = true

    await nextTick()

    return !collapsed.value
  }

  watch(
    () => options.getSchema().visible,
    (visible, _previousVisible, onCleanup) => {
      if (!fieldScrollRegistry || visible === false) {
        return
      }

      onCleanup(
        fieldScrollRegistry.registerGroup(groupPath, {
          requestExpand: requestExpandForScroll,
        })
      )
    },
    { immediate: true }
  )

  watch(
    () => options.getSchema().collapsed,
    (nextCollapsed, previousCollapsed) => {
      scrollExpanded.value = false

      if (nextCollapsed !== undefined) {
        internalCollapsed.value = nextCollapsed
      } else if (previousCollapsed !== undefined) {
        internalCollapsed.value = previousCollapsed
      }
    }
  )

  const toggle = (): void => {
    const schema = options.getSchema()

    if (!schema.collapsible || schema.disabled) {
      return
    }

    const nextCollapsed = !collapsed.value

    if (schema.collapsed === undefined) {
      internalCollapsed.value = nextCollapsed
    }

    schema.onCollapsedChange?.(nextCollapsed)
  }

  return {
    collapsed,
    toggle,
  }
}
