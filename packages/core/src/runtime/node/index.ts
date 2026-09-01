/**
 * Graph 模块统一导出。
 *
 * 提供 RuntimeNode、NodeManager、资源作用域和生命周期管理。
 *
 * @module core/runtime/node
 */

export { collectFieldRuntimeNodes, findFieldRuntimeNode } from "./helper"

export type {
  FieldDynamicOverrideKey,
  FieldDynamicOverrides,
  FieldEffectiveSchema,
  FieldRuntimeDiagnostics,
  FieldValidationSchema,
  ParentRuntimeNode,
  PresentationDynamicOverrides,
  PresentationState,
  PresentationStaticState,
  CreateDependencyRuntimeNodeOptions,
  CreateFieldRuntimeNodeOptions,
  CreateGroupRuntimeNodeOptions,
  CreateRootRuntimeNodeOptions,
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  RuntimeCleanup,
  RuntimeCleanupHandle,
  RuntimeScope,
  RuntimeNode,
  RuntimeNodeId,
  RuntimeNodeType,
  SchemaRuntimeNode,
} from "./types"

export {
  createNodeManager,
  type NodeManager,
  type NodeTreePredicate,
  type NodeTreeVisitor,
} from "./nodeManager"

export {
  createRuntimeNodeLifecycle,
  mountNodeResources,
  type RuntimeNodeLifecycle,
  unmountNodeResources,
  updateNodeResources,
} from "./resources"

export { createRuntimeScope, reportRuntimeCleanupError } from "./runtimeScope"
