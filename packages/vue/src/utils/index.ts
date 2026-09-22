/**
 * 工具函数统一导出
 *
 * @module utils
 */

/**
 * 动态属性解析
 */
export {
  type DependencieEntry,
  resolveDependencie,
  batchResolveDependencie,
} from "./dynamic"

/**
 * 校验触发工具
 */
export {
  type TriggerConfig,
  type NormalizedTrigger,
  shouldValidateOn,
  mergeTrigger,
} from "./validation"

/**
 * 插槽工具
 */
export { resolveSlot, extractChildSlots } from "./slot"

/**
 * 通用渲染辅助
 */
export { getSectionPosition, normalizeId, normalizeNameKey } from "./helpers"

/**
 * 布局间距工具。
 */
export { normalizeSchemxGutter, type SchemxNormalizedGutter } from "./layout"

/**
 * 对象差异工具。
 */
export { diff } from "./diff"
