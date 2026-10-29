/**
 * Dynamic 数组节点资源。
 *
 * 订阅 Store 的数组结构，按稳定行 key 展开模板；字段值只保存在路径值树中。
 * @module core/dynamic/resources
 */

import { createFieldKey } from "../utils/path"

import { createDynamicSchemaExpander } from "./expandSchemas"

import type { DynamicNode } from "../node/types"
import type { ChildReconciler, FormRuntimeContext } from "../runtimeContext"
import type { FieldArrayPath, NamePath, Values } from "../types"

/**
 * 挂载数组根的路径注册和结构监听。
 * @typeParam TValues - 表单值类型。
 * @param node - 已挂入节点树的 Dynamic。
 * @param context - 当前 Runtime 的路径 Store 和节点索引。
 * @param childReconciler - 提交行内 Schema 的协调入口。
 * @example mountDynamicResources(node, context, childReconciler)
 */
export function mountDynamicResources<TValues extends Values>(
  node: DynamicNode<TValues>,
  context: FormRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
): void {
  context.store.registerFieldPath(node.compiledSchema.peek().name as NamePath<TValues>)
  recreateDynamicSubscription(node, context, childReconciler)
}

/**
 * 数组模板或路径变化时重新展开，普通配置刷新不重建结构监听。
 * @typeParam TValues - 表单值类型。
 * @param node - 当前 Dynamic。
 * @param previousNode - 更新前的节点快照。
 * @param context - 当前 Runtime 的基础服务。
 * @param childReconciler - 提交行内 Schema 的协调入口。
 * @example updateDynamicResources(node, previousNode, context, childReconciler)
 */
export function updateDynamicResources<TValues extends Values>(
  node: DynamicNode<TValues>,
  previousNode: DynamicNode<TValues>,
  context: FormRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
): void {
  // 当前和旧路径用于切换 Store 注册，数组值不随节点改名复制。
  const previousSchema = previousNode.compiledSchema.peek()

  const currentSchema = node.compiledSchema.peek()

  context.store.registerFieldPath(currentSchema.name as NamePath<TValues>)

  if (
    createFieldKey(previousSchema.name) === createFieldKey(currentSchema.name) &&
    previousSchema.item === currentSchema.item
  ) {
    return
  }

  if (
    createFieldKey(previousSchema.name) !== createFieldKey(currentSchema.name) &&
    context.nodeManager.getNodeIds(previousSchema.name as NamePath<TValues>).length === 0
  ) {
    context.store.unregisterFieldPath(previousSchema.name as NamePath<TValues>)
  }

  recreateDynamicSubscription(node, context, childReconciler)
}

/**
 * 解除结构监听和行身份登记，数据继续留在 Store 中。
 * @typeParam TValues - 表单值类型。
 * @param node - 正在卸载的 Dynamic。
 * @param context - 用于注销路径和数组行的 Runtime 上下文。
 * @example unmountDynamicResources(node, context)
 */
export function unmountDynamicResources<TValues extends Values>(
  node: DynamicNode<TValues>,
  context: FormRuntimeContext<TValues>
): void {
  node.dynamicEffectScope?.dispose()
  node.dynamicEffectScope = null

  node.dynamicRows.value = []
  if (
    context.nodeManager.getNodeIds(node.compiledSchema.peek().name as NamePath<TValues>)
      .length === 0
  ) {
    context.store.unregisterFieldPath(
      node.compiledSchema.peek().name as NamePath<TValues>
    )
  }
}

/**
 * 以 Store 的行 key 为唯一结构来源，监听器在值发布前同步整批行路径。
 * @typeParam TValues - 表单值类型。
 * @param node - 当前 Dynamic。
 * @param context - 当前 Runtime 的路径 Store 和基础服务。
 * @param childReconciler - 行 Schema 的提交入口。
 */
function recreateDynamicSubscription<TValues extends Values>(
  node: DynamicNode<TValues>,
  context: FormRuntimeContext<TValues>,
  childReconciler: ChildReconciler<TValues>
): void {
  node.dynamicEffectScope?.dispose()

  // 本次订阅只属于当前数组路径和模板。
  const dynamicEffectScope = node.scope.child()

  node.dynamicEffectScope = dynamicEffectScope

  const schema = node.compiledSchema.peek()

  const arrayStructure = context.store.getArrayStructureHandle(
    schema.name as FieldArrayPath<TValues>
  )

  // 展开器独占 renderer 缓存，订阅只负责读取 Store 结构和提交 Schema。
  const expander = createDynamicSchemaExpander<TValues>(context.store)

  arrayStructure.register()

  /**
   * 经由协调器提交整批行和展开后的子 Schema。
   * @param preserveValues - Store 已移动数据时跳过旧索引值清理。
   */
  const syncRows = (preserveValues: boolean): void => {
    childReconciler.reconcileArray(node.id, {
      keys: arrayStructure.getKeys(),
      preserveValues,
      // rows 为协调器关联后的稳定行结构。
      createSchemas: (rows) => expander.expand(schema, rows),
    })
  }

  dynamicEffectScope.add(
    arrayStructure.subscribe((change) => {
      // change 来自 Store 已完成的结构提交，不能再通过 Schema 移除旧索引值。
      if (dynamicEffectScope.disposed) {
        return
      }

      syncRows(true)
      context.validator.invalidateFieldArray(schema.name as NamePath<TValues>, change)
    })
  )

  dynamicEffectScope.add(() => {
    expander.dispose()
    if (node.dynamicEffectScope === dynamicEffectScope) {
      node.dynamicEffectScope = null
    }
  })
  syncRows(false)
}
