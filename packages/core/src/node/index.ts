/**
 * Graph 模块统一导出。
 *
 * 提供 RuntimeNode、Reconciler 和资源作用域。
 *
 * @module core/node
 */

export {
  findFieldRuntimeNode,
  getChildRuntimeNodes,
  hasDescriptor,
  isContainerRuntimeNode,
  isDependencyRuntimeNode,
  isRootRuntimeNode,
  isFieldRuntimeNode,
  isGroupRuntimeNode,
  setChildRuntimeNodes,
  type ContainerRuntimeNode,
  type DependencyRuntimeNode,
  type DescribedRuntimeNode,
  type RuntimeNode,
  type RuntimeNodeType,
  type FieldRuntimeNode,
  type GroupRuntimeNode,
  type RootRuntimeNode,
} from "./runtimeNode"

export { createReconciler, type Reconciler } from "./reconciler"

export { createRuntimeNodeManager, type RuntimeNodeManager } from "./runtimeNodeManager"

export {
  createScope,
  reportRuntimeCleanupError,
  type ScopeCleanup,
  type ScopeCleanupHandle,
  type Scope,
} from "./scope"
