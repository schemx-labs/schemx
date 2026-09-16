/**
 * 依赖字段调度 effect 模块。
 *
 * @module core/runtime/dependencyScheduler
 */

export {
  createDependencySchedulerEffect,
  type CreateDependencySchedulerEffectOptions,
  type DependencySchedulerEffect,
} from "./createDependencySchedulerEffect"

export {
  type DependencyEffectDependencies,
  type DependencyResolverConfig,
  resolveDependencyProps,
  resolveDependencyOverrides,
} from "./resolveDependencyOverrides"
