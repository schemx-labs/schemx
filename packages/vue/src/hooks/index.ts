/**
 * Hooks 统一导出
 *
 * @module hooks
 */

/**
 * useForm - 表单状态管理
 */
export { useForm } from "./useForm"

/** Vue 兼容用的表单实例类型。 */
export type { VueSchemxInstance } from "../bridge"

/**
 * useField - 单字段控制
 */
export { useField } from "./useField"

/**
 * useWatch - 字段变化监听
 */
export { useWatch, useWatchField, useWatchFields, useWatchAll } from "./useWatch"

/**
 * useDictionary - 字典选项加载
 */
export {
  useDictionary,
  type UseDictionaryReturn,
  type UseDictOptionsReturn,
} from "./useDictionary"

/**
 * useStableRef - 引用稳定化的 shallowRef
 */
export { useStableRef } from "./useStableRef"

/**
 * useViewSchemas - ViewSchemas Vue 桥接
 */
export { useViewSchemas } from "./useViewSchemas"

/**
 * useFormSelector - 表单值 Selector Vue 桥接
 */
export { useFormSelector, type UseFormSelectorOptions } from "./useFormSelector"
