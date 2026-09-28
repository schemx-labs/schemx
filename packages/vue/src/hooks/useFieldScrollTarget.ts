/**
 * 注册 Field 容器元素并随字段路径变化更新注册表。
 *
 * @module hooks/useFieldScrollTarget
 */

import { onBeforeUnmount, watch } from "vue"
import type { ComponentPublicInstance } from "vue"

import { createFieldKey } from "@schemx/core"

import { useFieldScrollRegistry } from "../context/fieldScrollContext"

import type { NamePath, Values } from "@schemx/core"

/** 接收 Vue 模板 ref 值的字段容器回调。 */
export type FieldScrollTargetRef = (
  element: Element | ComponentPublicInstance | null
) => void

/** 初始化字段容器注册所需的响应式字段路径。 */
interface UseFieldScrollTargetOptions<TValues extends Values> {
  /** 获取当前字段的完整路径。 */
  getName: () => NamePath<TValues>
}

/**
 * 为当前 Field 注册可滚动容器，并返回 Vue 模板 ref 回调。
 *
 * @param options - 提供当前字段路径的 getter。
 * @returns 可绑定到字段容器的 ref 回调。
 *
 * @example
 * ```ts
 * const setTarget = useFieldScrollTarget({ getName: () => schema.value.name })
 * ```
 */
export function useFieldScrollTarget<TValues extends Values>(
  options: UseFieldScrollTargetOptions<TValues>
): FieldScrollTargetRef {
  const registry = useFieldScrollRegistry()

  let element: HTMLElement | undefined

  let unregister: (() => void) | undefined

  const register = (): void => {
    unregister?.()
    unregister = undefined

    if (registry && element) {
      unregister = registry.register(createFieldKey(options.getName()), element)
    }
  }

  const setTarget: FieldScrollTargetRef = (target) => {
    element = target instanceof HTMLElement ? target : undefined
    register()
  }

  watch(options.getName, register)

  onBeforeUnmount(() => {
    unregister?.()
    unregister = undefined
    element = undefined
  })

  return setTarget
}
