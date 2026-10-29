/**
 * 呈现状态模块统一导出。
 *
 * @module core/presentation
 */

export {
  PRESENTATION_DEPENDENCY_OVERRIDE_KEYS,
  createPresentationDependenciesEffect,
  type CreatePresentationDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  mountPresentationResources,
  unmountPresentationResources,
  updatePresentationResources,
} from "./resources"
