/**
 * Vue 表单实例的字段滚动方法注册与分发。
 *
 * @module bridge/scrollToField
 */

import type { SchemxInstance, ScrollToFieldOptions } from "../types"
import type { NamePath, Values } from "@schemx/core"

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
   * @returns 目标组件完成定位流程后返回是否成功。
   */
  handler: (name: unknown, options?: ScrollToFieldOptions) => Promise<boolean>
}

// 按实例方法隔离注册记录，避免多个表单实例相互干扰。
const handlersByDispatcher = new WeakMap<object, ScrollToFieldRegistration[]>()

/**
 * 创建 Vue 实例的字段滚动方法；未挂载组件时返回 `false`。
 *
 * 同一实例有多个挂载组件时，由最近注册的组件处理请求。
 * 当前处理函数返回 false 时直接返回结果，不向更早的注册记录回退。
 * @typeParam TValues - 表单值类型。
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
  /**
   * 按方法身份查找最近注册的实现，不在桥接层读取 DOM。
   * @param name - 本次请求的字段路径。
   * @param options - 原样交给挂载组件的滚动选项。
   */
  const scrollToField: SchemxInstance<TValues>["scrollToField"] = (name, options) => {
    // 共享同一个实例的组件按注册顺序保留，最后一项拥有处理优先级。
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
 * 注销当前记录后自动恢复前一个挂载组件，不影响同一实例的其他注册记录。
 * @typeParam TValues - 表单值类型。
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

  // 数组与 dispatcher 一起缓存，已创建的注销闭包持续引用同一份记录。
  const registrations = handlersByDispatcher.get(dispatcher) ?? []

  // 用独立对象标识本次挂载；相同 handler 多次注册也能分别注销。
  const registration: ScrollToFieldRegistration = {
    /**
     * 在异构缓存边界恢复当前实例的字段路径类型。
     * @param name - dispatcher 转交的字段路径。
     * @param options - dispatcher 转交的滚动选项。
     */
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

    // 按本次对象身份删除，不依赖曾经所在的数组位置。
    const registrationIndex = registrations.indexOf(registration)

    if (registrationIndex !== -1) {
      registrations.splice(registrationIndex, 1)
    }

    if (registrations.length === 0) {
      handlersByDispatcher.delete(dispatcher)
    }
  }
}
