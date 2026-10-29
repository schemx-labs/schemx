/**
 * 配置模块统一入口。
 *
 * 标准化能力先于全局配置导出，供全局配置在模块加载时建立初始快照。
 */

export {
  defaultSchemxConfig,
  defaultSchemxConfigKeys,
  excludeSchemxConfigKeys,
} from "./defaultSchemxConfig"

export type { ExcludeSchemxConfigKeys, SchemxConfigKey } from "./defaultSchemxConfig"

export {
  mergeConfig,
  mergeAndResolveSchemxConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
  type MergedSchemxConfig,
  type MergeConfigOptions,
  type SchemxConfigSnapshot,
} from "./mergeSchemxConfig"

export { normalizeSchemxConfig } from "./normalizeSchemxConfig"
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
