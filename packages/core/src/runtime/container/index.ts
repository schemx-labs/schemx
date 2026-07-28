/**
 * 容器状态模块统一导出。
 *
 * @module core/runtime/container
 */

export {
  CONTAINER_DEPENDENCIES_PROP_KEYS,
  createContainerDependenciesEffect,
  type CreateContainerDependenciesEffectOptions,
} from "./dependenciesEffect"

export {
  mountContainerNodeResources,
  updateContainerNodeResources,
  unmountContainerNodeResources,
} from "./nodeResources"

export {
  createContainerRuntimeState,
  createInheritedContainerState,
  type ContainerDynamicOverrides,
  type ContainerEffectiveState,
  type ContainerRuntimeState,
  type CreateContainerRuntimeStateOptions,
} from "./runtimeState"
