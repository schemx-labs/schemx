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

export { createRuntimeRegistry } from "./runtimeRegistry"

export type {
  PresentationDynamicProps,
  PresentationStaticState,
  DependencyRenderer,
  DependencyRuntimeNodeInput,
  FieldDynamicProps,
  FieldRuntimeNodeInput,
  FieldValidation,
  GroupRuntimeNodeInput,
  RuntimeNodeInput,
} from "./input"

export type {
  ParentRuntimeNode,
  CreateDependencyRuntimeNodeOptions,
  CreateFieldRuntimeNodeOptions,
  CreateGroupRuntimeNodeOptions,
  CreateRootRuntimeNodeOptions,
  CreateRuntimeNodeManagerOptions,
  CreateRuntimeNodeOptions,
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  RuntimeChildrenState,
  RuntimeCleanup,
  RuntimeCleanupHandle,
  RuntimeDispose,
  RuntimeFieldIndex,
  RuntimeNode,
  RuntimeNodeId,
  RuntimeNodeManager,
  RuntimeRegistry,
  RuntimeNodeType,
  SchemaRuntimeNode,
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
