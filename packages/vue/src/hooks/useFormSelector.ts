/**
 * useFormSelector - Core 表单值的 Vue 响应式选择器桥接。
 *
 * @module hooks/useFormSelector
 */

import { onScopeDispose, readonly, shallowRef, watch } from "vue"
import type { ShallowRef } from "vue"

import { getCoreForm, getVueFormBridge, retainVueFormBridge } from "../formBridge"

import type { SchemxInstance, Values } from "@schemx/core"

/**
 * `useFormSelector` 的选中结果比较配置。
 */
export interface UseFormSelectorOptions<TSelected> {
  /**
   * 判断两次 selector 结果是否等价；返回 true 时保持当前 Ref 值。
   * 默认使用 `Object.is`。
   */
  equals?: (previous: TSelected, next: TSelected) => boolean
}

/**
 * 将 Core 表单值按 selector 映射为 Vue 只读浅引用。
 *
 * selector 只应读取快照，不应通过快照修改表单值或调用表单写入方法。
 * `Readonly<TValues>` 仅表达顶层只读，嵌套字段应按不可变值使用；字段值需通过
 * `setFieldValue()` 或 `setFieldsValue()` 更新，才能触发后续计算。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TSelected - selector 返回值类型。
 * @param form - 要订阅的表单实例。
 * @param selector - 从当前表单值快照派生结果的纯函数。
 * @param options - 选中结果的比较配置。
 * @returns selector 当前结果的 Vue 只读浅引用。
 *
 * @example
 * ```ts
 * const selectedName = useFormSelector(form, (values) => values.name)
 *
 * watchEffect(() => {
 *   console.log(selectedName.value)
 * })
 * ```
 */
export function useFormSelector<
  TValues extends Values = Values,
  TSelected = unknown,
>(
  form: SchemxInstance<TValues>,
  selector: (values: Readonly<TValues>) => TSelected,
  options: UseFormSelectorOptions<TSelected> = {}
): Readonly<ShallowRef<TSelected>> {
  const bridge = getVueFormBridge(getCoreForm(form))

  const releaseBridge = retainVueFormBridge(bridge)

  const selected = shallowRef<TSelected>(selector(bridge.values.value))

  const equals = options.equals ?? Object.is

  /**
   * 根据完整快照重新计算 selector，并只在结果变化时更新 Ref。
   *
   * @param values - Bridge 发布的最新完整表单快照。
   */
  const stop = watch(
    bridge.values,
    (values) => {
      const next = selector(values)

      if (!equals(selected.value, next)) {
        selected.value = next
      }
    },
    { flush: "sync" }
  )

  onScopeDispose(() => {
    stop()
    releaseBridge()
  })

  return readonly(selected) as Readonly<ShallowRef<TSelected>>
}

export default useFormSelector
