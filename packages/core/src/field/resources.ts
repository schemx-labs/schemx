/**
 * Field Runtime 资源管理。
 *
 * 管理 FieldNode 的字段状态、校验和 dependencies effect。
 *
 * @module core/field/resources
 */

import { areNamePathListsEqual, createFieldKey } from "../utils"

import { createFieldDependenciesEffect, createValidationEffect } from "./index"

import type { FieldNode } from "../node"
import type { FormRuntimeContext } from "../runtimeContext"
import type { NamePath, SchemxFieldDependencies, Values } from "../types"

/**
 * 挂载字段运行时节点的资源。
 *
 * 依次创建字段运行态、写入初始值、创建校验和 dependencies effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param context - 当前 Runtime 的路径 Store、Registry 和校验端口。
 *
 * @example
 * ```ts
 * mountFieldResources(fieldNode, runtimeContext)
 * ```
 */
export function mountFieldResources<TValues extends Values>(
  node: FieldNode<TValues>,
  context: FormRuntimeContext<TValues>
): void {
  context.store.registerFieldPath(node.name.peek())
  applyFieldInitialValue(node, context)
  recreateFieldEffects(node, context)
}

/**
 * 更新字段运行时节点的资源。
 *
 * 改名时保留节点身份，数据和交互状态读取新路径；旧路径按旧 Schema 的 preserve 清理。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param previousNode - 更新前的字段运行时节点快照
 * @param context - 运行时上下文
 * @returns 旧字段不保留值时返回待清理路径，由 Reconciler 在整批提交后处理。
 *
 * @example
 * ```ts
 * updateFieldResources(fieldNode, previousNode, runtimeContext)
 * ```
 */
export function updateFieldResources<TValues extends Values>(
  node: FieldNode<TValues>,
  previousNode: FieldNode<TValues>,
  context: FormRuntimeContext<TValues>
): NamePath<TValues> | undefined {
  // 旧路径只用于解除旧注册和延迟值清理，不把其数据复制到目标路径。
  const previousName = previousNode.name.peek()

  const nameChanged = createFieldKey(previousName) !== createFieldKey(node.name.peek())

  context.store.registerFieldPath(node.name.peek())

  if (nameChanged) {
    // 其他节点已经占用旧地址时，保留该地址的 Store 注册。
    if (context.nodeManager.getNodeIds(previousName).length === 0) {
      context.store.unregisterFieldPath(previousName)
    }

    recreateValidationEffect(node, context)
  }

  const previousDependencies = previousNode.compiledSchema.peek().dependencies

  const nextDependencies = node.compiledSchema.peek().dependencies

  if (shouldRecreateDependenciesEffect(previousDependencies, nextDependencies)) {
    if (
      nextDependencies?.triggerFields == null ||
      nextDependencies.triggerFields.length === 0
    ) {
      node.dependencyOverrides.value = {}
    }

    recreateDependenciesEffect(node, context)
  }

  return nameChanged && previousNode.compiledSchema.peek().preserve === false
    ? previousName
    : undefined
}

/**
 * 卸载字段运行时节点的资源。
 *
 * 销毁 effect 并清理节点引用。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param context - 用于解除路径注册的 Runtime 上下文。
 *
 * @example
 * ```ts
 * unmountFieldResources(fieldNode, runtimeContext)
 * ```
 */
export function unmountFieldResources<TValues extends Values>(
  node: FieldNode<TValues>,
  context: FormRuntimeContext<TValues>
): void {
  // 同路径新节点已挂载时，其路径注册不能被旧节点的卸载移除。
  if (context.nodeManager.getNodeIds(node.name.peek()).length === 0) {
    context.store.unregisterFieldPath(node.name.peek())
  }

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
  context: FormRuntimeContext<TValues>
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
  context: FormRuntimeContext<TValues>
): void {
  node.validationEffectScope?.dispose()

  const validationEffectScope = node.scope.child()

  node.validationEffectScope = validationEffectScope

  createValidationEffect({
    context,
    nodeId: node.id,
    name: node.name.peek(),
    fallbackRules: () => context.fieldRules[node.name.value],
    validationState: node.validationState,
    scope: validationEffectScope,
    placeholder: () => node.resolvedSchema.peek().placeholder,
    rulesOverride: () => node.rulesOverride.value,
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
  context: FormRuntimeContext<TValues>
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
 * 如果 node.compiledSchema 中定义了 initialValue 且当前字段值
 * 尚未设置，则写入该初始值。仅在首次挂载时生效。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 要写入初始值的字段运行时节点
 * @param context - 运行时上下文
 */
function applyFieldInitialValue<TValues extends Values>(
  node: FieldNode<TValues>,
  context: FormRuntimeContext<TValues>
): void {
  const compiledSchema = node.compiledSchema.peek()

  if (!Object.hasOwn(compiledSchema, "initialValue")) {
    return
  }

  const store = context.store

  if (store.getFieldValue(node.name.peek()) !== undefined) {
    return
  }

  // 用 updater 返回值，函数类型的 initialValue 也作为普通值保存。
  const initialValue = compiledSchema.initialValue

  store.setInitialValue(node.name.peek(), () => initialValue)
  store.setFieldValue(node.name.peek(), () => initialValue)
}
