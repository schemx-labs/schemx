/**
 * Dependency 节点运行时模块。
 *
 * 提供动态 renderer effect 与节点资源装配。
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
  mountDependencyResources,
  unmountDependencyResources,
  updateDependencyResources,
} from "./resources"
