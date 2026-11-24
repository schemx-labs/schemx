/**
 * 依赖字段调度 effect 模块。
 *
 * @module core/runtime/dependencies
 */

export {
  createDependencySchedulerEffect,
  type CreateDependencySchedulerEffectOptions,
  type DependencySchedulerEffect,
} from "./createDependencySchedulerEffect"

export {
  type DependencyResolverConfig,
  resolveDependencyOverrides,
} from "./resolveDependencyOverrides"

export {
  createDependencyRendererEffect,
  getDependencyRendererEffect,
  hasDependencyRendererEffect,
  type CreateDependencyRendererEffectOptions,
  type DependencyRendererEffect,
} from "./rendererEffect"

export {
  mountDependencyResources,
  unmountDependencyResources,
  updateDependencyResources,
} from "./resources"

export { createDependencyNode } from "./createNode"
