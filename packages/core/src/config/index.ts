export {
  defaultSchemxConfig,
  defaultSchemxConfigKeys,
  excludeSchemxConfigKeys,
  schemaConfig,
  schemaConfigKeys,
  excludeSchemaConfigKeys,
} from "./defaultSchemxConfig"

export type {
  ExcludeSchemxConfigKeys,
  SchemxConfigKey,
  SchemaConfigKey,
  ExcludeSchemaConfigKeys,
} from "./defaultSchemxConfig"

export {
  mergeAndResolveSchemxConfig,
  mergeSchemxConfig,
  resolveSchemxConfig,
  type MergedSchemxConfig,
} from "./mergeSchemxConfig"

export { configureSchemx, getGlobalSchemxConfig } from "./schemxConfig"

export type { SchemxConfig } from "./schemxConfig"
