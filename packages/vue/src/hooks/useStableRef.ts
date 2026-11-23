/**
 * useStableRef - 引用稳定化的 shallowRef
 *
 * 封装 `shallowRef` + `watchEffect` + `isShallowEqual`，
 * 仅在工厂函数返回值与当前值浅不相等时才更新引用，
 * 避免下游组件因对象引用变化而不必要地重渲染。
 *
 * @module hooks/useStableRef
 *
 * @example
 * ```ts
 * import { useStableRef } from '@schemx/vue'
 *
 * const stableProps = useStableRef(() => ({
 *   visible: visible.value,
 *   disabled: disabled.value,
 *   value: field.getValue(),
 * }))
 * ```
 */

import { type ShallowRef, shallowRef, watchEffect } from "vue"

import { isShallowEqual } from "../utils/equal"

/**
 * 创建一个引用稳定的 shallowRef。
 *
 * 在 watchEffect 中执行工厂函数，自动追踪响应式依赖。
 * 仅当新旧值浅比较不相等时才替换 `.value`，保持引用稳定。
 *
 * @typeParam T - 对象类型
 *
 * @param factory - 返回目标对象的工厂函数，在 watchEffect 内执行
 *
 * @returns 只读的 ShallowRef，引用仅在属性值真正变化时更新
 *
 * @example
 * ```ts
 * const props = useStableRef(() => ({
 *   value: field.getValue(),
 *   onChange: handleChange,
 * }))
 *
 * // props.value 的引用在属性值未变时保持不变
 * h(Component, props.value)
 * ```
 */
export function useStableRef<T extends Record<string, any>>(
  factory: () => T
): Readonly<ShallowRef<T>> {
  const stableRef = shallowRef({} as T) as ShallowRef<T>

  watchEffect(() => {
    const next = factory()

    if (!isShallowEqual(stableRef.value, next)) {
      stableRef.value = next
    }
  })

  return stableRef
}

export default useStableRef
