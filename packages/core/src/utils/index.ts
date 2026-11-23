/**
 * 工具函数统一导出
 *
 * @module utils
 */

export {
  isBaseResolvedSchema,
  isGroupResolvedSchema,
  isDependencyResolvedSchema,
  isBaseSchema,
  isGroupSchema,
  isDependencySchema,
  findSchema,
} from "./schema"

export { normalizeSchemas } from "./normalize"

export { getByPath, setByPath, collectObjectPathsByLeaf, normalizeNamePath } from "./path"

export { withLock, waitAll } from "./async"

export { diff } from "./diff"

export { createStrictSingleton } from "./single"

export {
  resolveDynamicProp,
  resolveDynamicProps,
  resolveDynamicPropBatch,
  type DynamicProp,
  type DynamicPropEntry,
  type DynamicPropEntries,
} from "./dynamic"

export {
  type TriggerConfig,
  type NormalizedTrigger,
  shouldValidateOn,
  mergeTrigger,
} from "./validation"
