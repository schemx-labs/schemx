/**
 * Vue Context 统一导出。
 *
 * @module context
 */

/**
 * createFormContext - 表单实例上下文注入与消费。
 */
export {
  createFormConfigContext,
  createFormContext,
  provideFormContext,
  useFormConfigContext,
  useFormContext,
  useFormContextValue,
  useFormRuntimeContext,
  type FormConfigContextValue,
  type FormContextProps,
  type FormContextValue,
  type ProvideFormContextOptions,
} from "./formContext"

/**
 * createFieldContext - 当前字段上下文注入与消费。
 */
export { createFieldContext, useFieldContext } from "./fieldContext"

/**
 * ConfigProvider 组件树级配置上下文注入与消费。
 */
export {
  createConfigProviderContext,
  useConfigProviderContext,
  useConfigProviderContextRef,
} from "./configProviderContext"
