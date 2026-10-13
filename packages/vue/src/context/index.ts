/**
 * Vue Context 统一导出。
 *
 * @module context
 */

/**
 * Form Context 的 provide/inject API。
 */
export {
  provideFormContext,
  useFormContextValue,
  useFormContext,
  useFormConfigContext,
  useFormRuntimeContext,
  type FormConfigContextValue,
  type FormContextValue,
  createFormContext,
  createFormConfigContext,
} from "./formContext"

/**
 * createFieldContext - 当前字段上下文注入与消费。
 */
export { createFieldContext, useFieldContext } from "./fieldContext"

/**
 * ConfigProvider 组件树级配置上下文注入与消费。
 */
export {
  provideSchemxAppConfig,
  createConfigProviderContext,
  useConfigProviderContext,
  useConfigProviderContextRef,
} from "./configProviderContext"

/**
 * 连接适配包组件与同步创建器，不生成组件。
 */
export { provideSchemxFormRuntime } from "./schemxFormRuntime"
