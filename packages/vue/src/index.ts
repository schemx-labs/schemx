/**
 * schemx 统一导出入口
 *
 * @module @schemx/vue
 */
import "./styles/index.css"

// 载入 Core Schema 与配置的 Vue 声明合并，使适配包消费根入口时获得完整类型。
import "./types"

/**
 * 默认导出
 */
export { default, default as schemxForm } from "./form"

export type { SchemxFormPlugin, SchemxInstallOptions } from "./form"
export { createFormComponent } from "./adapter"

/**
 * 全局兼容 Registry 与布局工具。
 */
export {
  rendererRegistry,
  normalizeSchemxGutter,
  type SchemxNormalizedGutter,
  presetRuleRegistry,
} from "./utils"

/**
 * Hooks
 */
// 模块入口包含内部装配函数，包根仅转出原有公开 Hook。
export {
  useForm,
  useField,
  useWatch,
  useWatchField,
  useWatchFields,
  useWatchAll,
  useDictionary,
  useStableRef,
  useViewSchemas,
  useFormSelector,
} from "./hooks"
export type {
  UseFormOptions,
  VueSchemxInstance,
  UseDictionaryReturn,
  UseDictOptionsReturn,
  UseFormSelectorOptions,
} from "./hooks"

/**
 * Context
 */
export {
  provideFormContext,
  useFormContextValue,
  createFormContext,
  createFormConfigContext,
  useFormContext,
  useFormConfigContext,
  useFormRuntimeContext,
  createFieldContext,
  useFieldContext,
  createConfigProviderContext,
  useConfigProviderContext,
  useConfigProviderContextRef,
  provideSchemxAppConfig,
} from "./context"
export type { FormConfigContextValue, FormContextValue } from "./context"

/**
 * 高阶组件
 */
export { WithRemoteOptions } from "./hocs"

/**
 * 组件
 */
export { default as Field, type SchemxFieldProps } from "./components/Field"
export { default as Group, type SchemxGroupProps } from "./components/Group"
export { default as Col } from "./components/Col"
export { default as Row } from "./components/Row"
export { default as Button } from "./components/Button"
export { default as Icon } from "./components/Icon"
export { default as Wrapper } from "./components/Wrapper"
export {
  default as ConfigProvider,
  type ConfigProviderProps,
} from "./components/ConfigProvider"

/**
 * schemx/core 公共 API 与类型导出
 */
/* eslint-disable import/export -- Vue 的 SchemxLayout 兼容别名需要覆盖同名 Core 类型。 */
export * from "@schemx/core"

// 显式导出包含 Vue 默认配置的工厂，覆盖 Core 同名导出。
export { createSchemx } from "./createSchemx"

// 显式导出 Vue 布局兼容别名与实例类型，覆盖 Core 同名类型。
export type { SchemxLayout, SchemxInstance } from "./types"

/**
 * Types
 */
export * from "./types"
/* eslint-enable import/export */

export { defaultConfig } from "./config"
