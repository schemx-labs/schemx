import { createSchemx, useForm as useVueForm } from "@schemx/vue"

import { defaultConfig } from "./config/defaultConfig"

import type { Values } from "@schemx/core"
import type { SchemxInstance, UseFormOptions } from "@schemx/vue"

// 本包共享实例，组件和 Hook 使用同一个创建器。
export const schemx = createSchemx(defaultConfig)
export const { createForm, configureSchemx, getConfig } = schemx

/**
 * 使用本包创建器创建 Vue scope 所有的表单。
 * @typeParam TValues - 本次表单值类型。
 * @param options - 实例选项与局部配置。
 * @example const form = useForm({ initialValues: { name: "" } })
 */
export function useForm<TValues extends Values = Values>(
  options: UseFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  return useVueForm(options, createForm)
}
