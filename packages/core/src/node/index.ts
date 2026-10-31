/**
 * Graph 模块统一导出。
 *
 * 提供 Node、NodeManager、资源作用域和节点资源操作。
 *
 * @module core/node
 */

export {
  findFieldNode,
  isDynamicNode,
  isRootNode,
  isSchemaNode,
  isFieldNode,
  isGroupNode,
  isDependencyNode,
  updateFieldDiagnostics,
  isParentNode,
} from "./helper"

export type {
  FieldDependencyOverrideKey,
  FieldDependencyOverrides,
  ResolvedFieldSchema,
  FieldRuntimeDiagnostics,
  FieldValidationState,
  ParentNode,
  PresentationDependencyOverrides,
  PresentationState,
  CreateDependencyNodeOptions,
  CreateFieldNodeOptions,
  CreateGroupNodeOptions,
  CreateRootNodeOptions,
  DependencyNode,
  DynamicNode,
  DynamicRowState,
  FieldNode,
  GroupNode,
  RootNode,
  Cleanup,
  CleanupHandle,
  Scope,
  ContainerNode,
  NodeType,
  SchemaNode,
  StatefulPresentationNode,
  CleanupRecord,
} from "./types"

export { createNodeManager } from "./nodeManager"
export type { NodeManager, NodePathUpdate } from "./nodeManager"

export type { NodeId } from "./types"
export type { NodeSnapshot, NodeUpdateSnapshot, NodeLifecycleHooks } from "./snapshot"
export { createNodeSnapshot, captureNodeUpdate } from "./snapshot"

export {
  disposeNodeResources,
  mountNodeResources,
  unmountNodeResources,
  updateNodeResources,
} from "./resources"

export { createScope, reportCleanupError } from "./scope"
