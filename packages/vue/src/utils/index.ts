/**
 * 工具函数统一导出
 *
 * @module utils
 */

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

export { presetRuleRegistry } from "./presetRuleProvider"
export { rendererRegistry } from "./rendererProvider"
export { isShallowEqual } from "./equal"
