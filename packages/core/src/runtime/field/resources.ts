/**
 * Field Runtime 资源管理。
 *
 * 管理 FieldNode 的字段状态、校验和 dependencies effect。
 *
 * @module core/runtime/field/resources
 */

import { batchUpdates } from "../../reactivity"
import { createFieldKey, setByPath } from "../../utils"
import { areNamePathListsEqual } from "../../utils/path"

import { createFieldDependenciesEffect } from "./dependenciesEffect"
import { createValidationEffect } from "./validationEffect"

import type { NamePath, SchemxFieldDependencies, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { FieldNode } from "../node"

/**
 * 挂载字段运行时节点的资源。
 *
 * 依次创建字段运行态、写入初始值、创建校验和 dependencies effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param context - 运行时上下文
 */
export function mountFieldResources<TValues extends Values>(
  node: FieldNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  context.store.registerFieldPath(node.name.peek())
  applyFieldInitialValue(node, context)
  recreateFieldEffects(node, context)
}

/**
 * 更新字段运行时节点的资源。
 *
 * 当字段名变化时先注销旧索引并重新注册新路径，然后按配置变化重建校验和
 * dependencies effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param previousNode - 更新前的字段运行时节点快照
 * @param context - 运行时上下文
 */
export function updateFieldResources<TValues extends Values>(
  node: FieldNode<TValues>,
  previousNode: FieldNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const previousName = previousNode.name.peek()

  const nameChanged = createFieldKey(previousName) !== createFieldKey(node.name.peek())

  if (nameChanged) {
    batchUpdates(() => {
      context.store.unregisterFieldPath(previousName)

      if (previousNode.staticSchema.peek().preserve === false) {
        context.store.removeFieldValue(previousName)
      }

      context.store.registerFieldPath(node.name.peek())
    })
  }

  if (!nameChanged) {
    context.store.registerFieldPath(node.name.peek())
  }

  if (nameChanged) {
    recreateValidationEffect(node, context)
  }

  const previousDynamicConfig = previousNode.staticSchema.peek().dependencies

  const dynamicConfig = node.staticSchema.peek().dependencies

  if (shouldRecreateDependenciesEffect(previousDynamicConfig, dynamicConfig)) {
    recreateDependenciesEffect(node, context)
  }
}

/**
 * 卸载字段运行时节点的资源。
 *
 * 销毁 effect 并清理节点引用。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param context - 运行时上下文
 */
export function unmountFieldResources<TValues extends Values>(
  node: FieldNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  context.store.unregisterFieldPath(node.name.peek())
  node.validationEffectScope?.dispose()
  node.validationEffectScope = null
  node.dependenciesEffectScope?.dispose()
  node.dependenciesEffectScope = null
  // 运行态 Signal 在节点创建时初始化，卸载只释放字段资源。
}

/**
 * 重建字段的校验和 dependencies effect。
 *
 * 销毁旧 validationEffectScope 作用域，在子作用域中重新创建
 * createValidationEffect 和 createFieldDependenciesEffect。
 * effect 销毁时自动清理 node.validationEffectScope 引用。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 字段运行时节点
 * @param context - 运行时上下文
 */
function recreateFieldEffects<TValues extends Values>(
  node: FieldNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  recreateValidationEffect(node, context)
  recreateDependenciesEffect(node, context)
}

/**
 * 创建或重建字段的 validation effect。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 当前字段运行时节点。
 * @param context - 表单运行时上下文。
 */
function recreateValidationEffect<TValues extends Values>(
  node: FieldNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  node.validationEffectScope?.dispose()

  const validationEffectScope = node.scope.child()

  node.validationEffectScope = validationEffectScope

  createValidationEffect({
    context,
    name: node.name.value,
    validationSchema: node.validationSchema,
    scope: validationEffectScope,
  })

  validationEffectScope.add(() => {
    if (node.validationEffectScope === validationEffectScope) {
      node.validationEffectScope = null
    }
  })
}

/**
 * 创建或重建字段的 dependencies effect。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 当前字段运行时节点。
 * @param context - 表单运行时上下文。
 */
function recreateDependenciesEffect<TValues extends Values>(
  node: FieldNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  node.dependenciesEffectScope?.dispose()

  const dependenciesEffectScope = node.scope.child()

  node.dependenciesEffectScope = dependenciesEffectScope

  createFieldDependenciesEffect({
    context,
    taskId: `field:${node.id}:dependencies`,
    node,
    scope: dependenciesEffectScope,
  })

  dependenciesEffectScope.add(() => {
    if (node.dependenciesEffectScope === dependenciesEffectScope) {
      node.dependenciesEffectScope = null
    }
  })
}

/**
 * 判断 dependencies 配置是否需要重建 effect。
 *
 * @typeParam TValues - 表单值类型。
 * @param previous - 上一轮 dependencies 配置。
 * @param next - 当前 dependencies 配置。
 * @returns 配置引用或触发字段集合变化时返回 `true`。
 */
function shouldRecreateDependenciesEffect<TValues extends Values>(
  previous: SchemxFieldDependencies<TValues> | undefined,
  next: SchemxFieldDependencies<TValues> | undefined
): boolean {
  if (previous !== next) {
    return true
  }

  return !areNamePathListsEqual(previous?.triggerFields ?? [], next?.triggerFields ?? [])
}

/**
 * 写入字段初始值。
 *
 * 如果 node.staticSchema 中定义了 initialValue 且当前字段值
 * 尚未设置，则写入该初始值。仅在首次挂载时生效。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要写入初始值的字段运行时节点
 * @param context - 运行时上下文
 */
function applyFieldInitialValue<TValues extends Values>(
  node: FieldNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const staticSchema = node.staticSchema.value

  if (!Object.hasOwn(staticSchema, "initialValue")) {
    return
  }

  const store = context.store

  if (store.getFieldValue(node.name.value) !== undefined) {
    return
  }

  const initialValue = staticSchema.initialValue as never

  const initialValues = {} as Partial<TValues>

  setByPath<TValues, NamePath<TValues>, never>(
    initialValues,
    node.name.value,
    initialValue
  )
  store.setInitialValues(initialValues)
  store.setFieldValue(node.name.value, initialValue)
}
