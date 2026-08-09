/**
 * 呈现状态模块统一导出。
 *
 * @module core/runtime/presentation
 */

export {
  PRESENTATION_DEPENDENCIES_PROP_KEYS,
  createPresentationDependenciesEffect,
  type CreatePresentationDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  mountPresentationRuntime,
  unmountPresentationRuntime,
  updatePresentationRuntime,
} from "./lifecycle"

export {
  createInheritedPresentationState,
  createPresentationRuntimeState,
  resolvePresentationState,
  DEFAULT_PRESENTATION_STATE,
  type CreatePresentationRuntimeStateOptions,
  type PresentationDynamicOverrides,
  type PresentationRuntimeState,
  type PresentationState,
} from "./state"
