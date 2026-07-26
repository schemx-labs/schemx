/**
 * Graph 模块统一导出。
 *
 * 提供 RuntimeNode、RuntimeNodeManager、资源作用域和生命周期管理。
 *
 * @module core/runtime/node
 */

export {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "./runtimeNode"

export { createRuntimeResources, deleteNodeResources } from "./resources"

export type {
  ContainerRuntimeNode,
  CreateDependencyRuntimeNodeOptions,
  CreateFieldRuntimeNodeOptions,
  CreateGroupRuntimeNodeOptions,
  CreateRootRuntimeNodeOptions,
  CreateRuntimeNodeManagerOptions,
  CreateRuntimeNodeOptions,
  DependencyRuntimeNode,
  DescribedRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  RuntimeChildrenState,
  RuntimeCleanup,
  RuntimeCleanupHandle,
  RuntimeDependencyIndex,
  RuntimeDispose,
  RuntimeFieldIndex,
  RuntimeNode,
  RuntimeNodeId,
  RuntimeNodeManager,
  RuntimeNodeResourceContext,
  RuntimeNodeResourceMaps,
  RuntimeNodeType,
  Scope,
  ScopeCleanup,
  ScopeCleanupHandle,
} from "./types"

export { createRuntimeNodeManager } from "./runtimeNodeManager"

export { createRuntimeLifecycle, type RuntimeLifecycle } from "./runtimeLifecycle"

export {
  createRuntimeDispose,
  createRuntimeScope,
  createScope,
  reportRuntimeCleanupError,
} from "./scope"
