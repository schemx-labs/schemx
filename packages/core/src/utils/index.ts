/**
 * 工具函数统一导出
 *
 * @module utils
 */

export {
  isFieldSchema,
  isGroupSchema,
  isDependencySchema,
  isDynamicSchema,
  isValidSchema,
  getSchemaKind,
} from "./schema"

export {
  getByPath,
  setByPath,
  collectObjectPathsByLeaf,
  normalizeNamePath,
  toNamePathSegments,
  toStructuralPathSegments,
  setInWithStructuralSharing,
  deleteInWithStructuralSharing,
  isDescendantFieldPath,
  areSameOrOverlappingFieldPaths,
  areOverlappingFieldPaths,
  createFieldKey,
  type FieldKey,
  areNamePathListsEqual,
  isFieldArrayDescendantAffected,
  isFieldArrayDescendantOutOfRange,
} from "./path"

export { withLock } from "./async"

export { diff } from "./diff"

export {
  type TriggerConfig,
  type NormalizedTrigger,
  shouldValidateOn,
} from "./validation"

export {
  type DebounceEdge,
  type DebouncedFnOptions,
  type DebouncedFnControls,
  createDebouncedFn,
} from "./createDebouncedFn"
