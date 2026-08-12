/**
 * Hooks 统一导出
 *
 * @module hooks
 */

/** useForm - 表单状态管理 */
export { useForm } from "./useForm"

/** Vue Form Facade - 在 Vue effect 中可追踪的 Form 实例。 */
export { getCoreForm, type VueSchemxInstance } from "../formBridge"

/** createFormContext - 表单上下文注入与消费 */
export { createFormContext, useFormContext } from "./provideFormContext"

/** useField - 单字段控制 */
export { useField } from "./useField"

/** createFieldContext - 表单上下文注入与消费 */
export { createFieldContext, useFieldContext } from "./provideFieldContext"

/** useWatch - 字段变化监听 */
export { useWatch, useWatchField, useWatchFields, useWatchAll } from "./useWatch"

/** useDictionary - 字典选项加载 */
export { useDictionary, type UseDictionaryReturn } from "./useDictionary"

/** useFormConfigContext - 表单上下文注入与消费 */
export {
  createFormConfigContext,
  useFormConfigContext,
  type FormContextProps,
} from "./provideFormConfigContext"

/** useStableRef - 引用稳定化的 shallowRef */
export { useStableRef } from "./useStableRef"

/** useViewSchemas - ViewSchemas Vue 桥接 */
export { useViewSchemas } from "./useViewSchemas"

/** useFormSelector - 表单值 Selector Vue 桥接 */
export {
  useFormSelector,
  type UseFormSelectorOptions,
} from "./useFormSelector"
