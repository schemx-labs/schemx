/**
 * Graph 模块统一导出。
 *
 * 提供 Node、NodeManager、资源作用域和生命周期管理。
 *
 * @module core/runtime/node
 */

export { findFieldNode, isRootNode, isSchemaNode } from "./helper"

export type {
  FieldDynamicOverrideKey,
  FieldDynamicOverrides,
  FieldEffectiveSchema,
  FieldRuntimeDiagnostics,
  FieldValidationSchema,
  ParentNode,
  PresentationDynamicOverrides,
  PresentationStaticState,
  CreateDependencyNodeOptions,
  CreateFieldNodeOptions,
  CreateGroupNodeOptions,
  CreateRootNodeOptions,
  DependencyNode,
  FieldNode,
  GroupNode,
  RootNode,
  Cleanup,
  CleanupHandle,
  Scope,
  ContainerNode,
  NodeId,
  NodeType,
  SchemaNode,
} from "./types"

export { createNodeManager, type NodeManager } from "./nodeManager"

export {
  createNodeLifecycle,
  mountNodeResources,
  type NodeLifecycle,
  type NodeUnmountOptions,
  unmountNodeResources,
  updateNodeResources,
} from "./resources"

export { createScope, reportCleanupError } from "./scope"
