/**
 * 工具函数统一导出
 *
 * @module utils
 */

/** 动态属性解析 */
export {
  type DependencieEntry,
  resolveDependencie,
  batchResolveDependencie,
} from "./dynamic"

/** 校验触发工具 */
export {
  type TriggerConfig,
  type NormalizedTrigger,
  shouldValidateOn,
  mergeTrigger,
} from "./validation"

/** 插槽工具 */
export { resolveSlot, extractChildSlots } from "./slot"

export { diff } from "./diff"
