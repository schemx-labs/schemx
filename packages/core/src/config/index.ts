/**
 * 配置模块统一入口。
 *
 * 标准化能力先于全局配置导出，供全局配置在模块加载时建立初始快照。
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

export { configureSchemx, getGlobalSchemxConfig } from "./schemxConfig"

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
