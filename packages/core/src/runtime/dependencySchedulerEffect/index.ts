/**
 * 依赖字段调度 effect 模块。
 *
 * @module core/runtime/dependencySchedulerEffect
 */

export {
  createDepSchedulerEffect,
  type CreateDepSchedulerEffectOptions,
  type DepSchedulerEffect,
} from "./createDepSchedulerEffect"

export {
  type DependencyEffectDependencies,
  resolveDependencyProps,
} from "./resolveDependencyProps"
