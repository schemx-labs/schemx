/**
 * 配置模块统一入口。
 *
 * 提供配置合并、默认值解析与实例配置管理。
 */

export { defaultSchemxConfig } from "./defaultSchemxConfig"
export type { SchemxConfigKey } from "./defaultSchemxConfig"

export {
  mergeConfig,
  resolveSchemxConfig,
  type MergedSchemxConfig,
  type MergeConfigOptions,
  type SchemxConfigSnapshot,
} from "./mergeSchemxConfig"

export type {
  SchemxConfig,
  SchemxConfigDefinition,
  CreateFormOptions,
  ResolvedCreateFormOptions,
  FormCallbackOptions,
  FormLifecycleOptions,
  FormPerformanceOptions,
  FormRegistryOptions,
  FormSchemaOptions,
} from "./types"

export { createFormConfig } from "./createFormConfig"
export type {
  FormConfig,
  ResolvedFormConfig,
  ApplyFormConfig,
  FormConfigModel,
} from "./createFormConfig"
