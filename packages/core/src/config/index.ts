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
} from "./mergeSchemxConfig"

export { configureSchemx, getGlobalSchemxConfig } from "./schemxConfig"
export { normalizeSchemxConfig } from "./normalizeSchemxConfig"

export type { SchemxConfig, SchemxConfigDefinition } from "./schemxConfig"
