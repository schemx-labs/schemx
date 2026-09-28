/**
 * Vue 表单实例的字段滚动方法注册与分发。
 *
 * @module bridge/scrollToField
 */

import type { ScrollToFieldOptions } from "../types/form"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

/**
 * 已挂载的 `<Schemx>` 组件提供的字段滚动实现。
 *
 * @param name - 目标字段路径。
 * @param options - 滚动行为与对齐方式。
 * @returns 字段可滚动时返回 `true`。
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * const handler: VueScrollToFieldHandler<{ name: string }> = async (name) => {
 *   const element = document.querySelector(`[data-field="${name}"]`)
 *   element?.scrollIntoView()
 *   return Boolean(element)
 * }
 * ```
 */
export type VueScrollToFieldHandler<TValues extends Values = Values> = (
  name: NamePath<TValues>,
  options?: ScrollToFieldOptions
) => Promise<boolean>

// 保存一次组件挂载对应的滚动处理函数。
interface ScrollToFieldRegistration {
  /**
   * 将字段定位请求交给对应的已挂载组件。
   *
   * @param name - 目标字段路径。
   * @param options - 滚动行为与对齐方式。
   */
  handler: (name: unknown, options?: ScrollToFieldOptions) => Promise<boolean>
}

// 按实例方法隔离注册记录，避免多个表单实例相互干扰。
const handlersByDispatcher = new WeakMap<object, ScrollToFieldRegistration[]>()

/**
 * 创建 Vue 实例的字段滚动方法；未挂载组件时返回 `false`。
 *
 * 同一实例有多个挂载组件时，由最近注册的组件处理请求。
 *
 * @example
 * ```ts
 * const scrollToField = createVueScrollToFieldDispatcher<{ name: string }>()
 * await scrollToField("name") // 组件尚未注册时返回 false
 * ```
 */
export function createVueScrollToFieldDispatcher<
  TValues extends Values,
>(): SchemxInstance<TValues>["scrollToField"] {
  // 分发方法自身作为 WeakMap 键，保持实例之间独立。
  const scrollToField: SchemxInstance<TValues>["scrollToField"] = (name, options) => {
    const registrations = handlersByDispatcher.get(scrollToField)

    // 后注册的挂载组件优先处理共享实例的滚动请求。
    const activeRegistration = registrations?.[registrations.length - 1]

    return activeRegistration
      ? activeRegistration.handler(name, options)
      : Promise.resolve(false)
  }

  return scrollToField
}

/**
 * 注册已挂载 Vue 表单的 DOM 滚动处理函数，并返回可重复调用的注销函数。
 *
 * @param instance - 需要接收滚动请求的 Vue 表单实例。
 * @param handler - 由已挂载组件提供的字段滚动实现。
 * @returns 组件卸载时调用的注销函数。
 *
 * @example
 * ```ts
 * const unregister = registerVueScrollToFieldHandler(instance, handler)
 * unregister()
 * ```
 */
export function registerVueScrollToFieldHandler<TValues extends Values>(
  instance: SchemxInstance<TValues>,
  handler: VueScrollToFieldHandler<TValues>
): () => void {
  // 同一实例可能先后或同时被多个 Vue 组件挂载。
  const dispatcher = instance.scrollToField

  const registrations = handlersByDispatcher.get(dispatcher) ?? []

  const registration: ScrollToFieldRegistration = {
    handler: (name, options) => handler(name as NamePath<TValues>, options),
  }

  registrations.push(registration)
  handlersByDispatcher.set(dispatcher, registrations)

  // 防止重复清理影响后续注册记录。
  let isRegistered = true

  return () => {
    if (!isRegistered) {
      return
    }

    isRegistered = false

    const registrationIndex = registrations.indexOf(registration)

    if (registrationIndex !== -1) {
      registrations.splice(registrationIndex, 1)
    }

    if (registrations.length === 0) {
      handlersByDispatcher.delete(dispatcher)
    }
  }
}
