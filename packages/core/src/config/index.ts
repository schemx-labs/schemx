export {
  defaultSchemxConfig,
  defaultSchemxConfigKeys,
  excludeSchemxConfigKeys,
} from "./defaultSchemxConfig"

export type { ExcludeSchemxConfigKeys, SchemxConfigKey } from "./defaultSchemxConfig"

export {
  mergeAndResolveSchemxConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
  type MergedSchemxConfig,
} from "./mergeSchemxConfig"

export { configureSchemx, getGlobalSchemxConfig } from "./schemxConfig"

export type { SchemxConfig } from "./schemxConfig"
