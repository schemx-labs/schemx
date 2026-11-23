/**
 * SchemxInstance - 表单实例核心类
 *
 * 组合 Store、Validator，提供统一的表单操作接口。
 * 实现 SchemxInstance 接口，作为 useForm 的底层实现。
 *
 * @module hooks/useForm
 *
 * @example
 * ```typescript
 * import { useForm } from './useForm'
 *
 * // 在 Vue 组件中使用
 * const form = useForm({
 *   schemas: [...],
 *   initialValues: { name: '', age: 0 },
 *   onFinish: (values) => console.log(values),
 * })
 *
 * // 或直接创建实例（非组件场景）
 * const instance = createForm({ initialValues: { name: '' } })
 * ```
 */
import { computed, inject, onUnmounted, provide } from "vue"

import { createForm } from "@schemx/core"

import { rendererRegistry as globalRendererRegistry } from "../utils/rendererProvider"
import { validatorRegistry as globalRulesRegistry } from "../utils/rulesProvider"

import type { CreateFormOptions, NamePath, SchemxInstance, Values } from "@schemx/core"

/** SchemxInstance 在 Vue provide/inject 中的注入 key */
export const SCHEMX_INSTANCE_KEY = Symbol("SCHEMX_INSTANCE")
/** @deprecated 请使用 SCHEMX_INSTANCE_KEY。保留给旧测试和旧适配代码兼容。 */
export const FORM_INSTANCE_KEY = SCHEMX_INSTANCE_KEY

/**
 * useForm 配置选项
 *
 * 扩展 core 层的 CreateFormOptions，增加 Vue 层特有的 request 配置。
 *
 * @typeParam TValues - 表单值类型
 */
export interface UseFormOptions<TValues extends Values> extends CreateFormOptions<
  TValues,
  NamePath<TValues>
> {}

/**
 * 表单组合式函数
 *
 * 创建 SchemxInstance 并通过 Vue provide 注入到子组件树中，
 * 组件卸载时自动销毁实例。
 *
 * @typeParam TValues - 表单值类型
 *
 * @param options - 表单配置选项
 * @returns 表单实例（SchemxInstance 接口）
 *
 * @example
 * ```typescript
 * // 在 setup 中使用
 * const form = useForm({
 *   initialValues: { name: '', email: '' },
 *   onFinish: async (values) => {
 *     await api.submit(values)
 *   },
 * })
 *
 * form.setFieldValue('name', 'John')
 * ```
 */
export function useForm<TValues extends Values = Values>(
  options: UseFormOptions<TValues>
): SchemxInstance<TValues> {
  const { ...formOptions } = options

  const mergedOptions: CreateFormOptions<TValues> = {
    ...formOptions,
    rendererRegistry: formOptions.rendererRegistry ?? globalRendererRegistry,
    validatorRegistry: formOptions.validatorRegistry ?? globalRulesRegistry,
  }

  const instance = computed(() => createForm<TValues>(mergedOptions))

  provide<SchemxInstance<TValues>>(SCHEMX_INSTANCE_KEY, instance.value)

  onUnmounted(() => {
    instance.value.destroy()
  })

  return instance.value
}

/**
 * 获取表单实例
 *
 * 在子组件中获取 useForm 创建的 SchemxInstance，
 * 可用于读写字段值、校验、订阅等操作。
 *
 * @typeParam TValues - 表单值类型
 * @returns 表单实例
 *
 * @throws Error 如果不在 schemx 提供的上下文中调用
 *
 * @example
 * ```ts
 * const form = useFormInstance()
 * form.setFieldValue('name', 'hello')
 * ```
 */
export function useFormInstance<
  TValues extends Values = Values,
>(): SchemxInstance<TValues> {
  const instance = inject<SchemxInstance<TValues>>(SCHEMX_INSTANCE_KEY)

  if (!instance) {
    throw new Error("useFormInstance must be used within a Form")
  }

  return instance
}
