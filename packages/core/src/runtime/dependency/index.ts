/**
 * Dependency 节点运行时模块。
 *
 * 提供动态 renderer effect 与节点生命周期装配。
 *
 * @module core/runtime/dependency
 */

export {
  createDependencyRendererEffect,
  getDependencyRendererEffect,
  hasDependencyRendererEffect,
  type CreateDependencyRendererEffectOptions,
  type DependencyRendererEffect,
} from "./rendererEffect"

export {
  mountDependencyRuntime,
  unmountDependencyRuntime,
  updateDependencyRuntime,
} from "./lifecycle"
