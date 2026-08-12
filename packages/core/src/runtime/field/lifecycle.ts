/**
 * Field Runtime 生命周期管理。
 *
 * 管理 FieldRuntimeNode 的生命周期：创建字段运行态、视图状态、注册字段索引、
 * 创建校验和 dependencies effect。
 *
 * @module core/runtime/field/lifecycle
 */

import { setByPath } from "../../utils"
import { areNamePathListsEqual } from "../../utils/path"
import { createInheritedPresentationState } from "../presentation/state"
import { createRuntimeViewState } from "../view/createViewState"

import { createDependenciesEffect } from "./dependenciesEffect"
import { createFieldRuntimeState, setFieldStaticSchema } from "./runtimeState"
import { createValidationEffect } from "./validationEffect"

import type { NamePath, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { FieldDynamicProps, FieldRuntimeNode } from "../node"
import type { FieldRuntimeState } from "./runtimeState"

/**
 * 挂载字段运行时节点的资源。
 *
 * 依次创建字段运行态、写入初始值、创建视图状态、注册字段索引、
 * 创建校验和 dependencies effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param descriptor - 字段 descriptor
 * @param context - 运行时上下文
 */
export function mountFieldRuntime<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const registry = context.runtimeRegistry

  const runtimeState = createFieldRuntimeState<TValues>({
    nodeId: node.id,
    key: node.key,
    name: node.name,
    staticSchema: node.staticSchema,
    inheritedState: createInheritedPresentationState(node),
    debug: context.debug,
  })

  context.model.registerFieldPath(node.name)
  applyFieldInitialValue(node, context)
  node.fieldState = runtimeState
  createRuntimeViewState(node, context.debug)
  registry.fieldIndex.register(node)
  recreateFieldEffects(node, runtimeState, context)
}

/**
 * 更新字段运行时节点的资源。
 *
 * 当字段名变化时先注销旧索引；更新静态 schema、视图状态、重新注册索引，
 * 然后重建校验和 dependencies effect。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param previousDescriptor - 上一轮 descriptor（用于比较字段名）
 * @param nextDescriptor - 最新 descriptor
 * @param context - 运行时上下文
 */
export function updateFieldRuntime<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  previousName: NamePath<TValues> | undefined,
  previousDynamicProps: FieldDynamicProps<TValues> | null | undefined,
  context: SchemaRuntimeContext<TValues>
): void {
  const registry = context.runtimeRegistry

  const runtimeState = node.fieldState

  if (!runtimeState) {
    mountFieldRuntime(node, context)

    return
  }

  if (previousName && previousName !== node.name) {
    registry.fieldIndex.unregister(node, previousName)
  }

  setFieldStaticSchema(runtimeState, node)
  context.model.registerFieldPath(node.name)
  registry.fieldIndex.register(node)
  if (previousName !== node.name) {
    recreateValidationEffect(node, runtimeState, context)
  }

  if (shouldRecreateDependenciesEffect(previousDynamicProps, node.dynamicProps)) {
    recreateDependenciesEffect(node, runtimeState, context)
  }
}

/**
 * 卸载字段运行时节点的资源。
 *
 * 从字段索引注销，销毁 effect 并清理节点引用。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 目标字段运行时节点
 * @param context - 运行时上下文
 */
export function unmountFieldRuntime<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const registry = context.runtimeRegistry

  registry.fieldIndex.unregister(node, node.name)
  node.effectDispose?.dispose()
  node.effectDispose = null
  node.dependenciesEffectDispose?.dispose()
  node.dependenciesEffectDispose = null
  node.fieldState = null
}

/**
 * 重建字段的校验和 dependencies effect。
 *
 * 销毁旧 effectDispose 作用域，在子作用域中重新创建
 * createValidationEffect 和 createDependenciesEffect。
 * effect 销毁时自动清理 node.effectDispose 引用。
 *
 * @typeParam TValues - 表单值类型
 * @param node - 字段运行时节点
 * @param descriptor - 字段 descriptor
 * @param runtimeState - 字段运行态
 * @param context - 运行时上下文
 */
function recreateFieldEffects<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  runtimeState: FieldRuntimeState<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  recreateValidationEffect(node, runtimeState, context)
  recreateDependenciesEffect(node, runtimeState, context)
}

/** 创建或重建仅随字段 name 变化的 validation effect。 */
function recreateValidationEffect<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  runtimeState: FieldRuntimeState<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  node.effectDispose?.dispose()

  const effectDispose = node.dispose.child()

  node.effectDispose = effectDispose

  createValidationEffect({
    context,
    name: node.name,
    validationSchema: runtimeState.validationSchema,
    scope: effectDispose,
  })

  effectDispose.add(() => {
    if (node.effectDispose === effectDispose) {
      node.effectDispose = null
    }
  })
}

/** 创建或重建 dependencies 配置发生变化的 effect。 */
function recreateDependenciesEffect<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  runtimeState: FieldRuntimeState<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  node.dependenciesEffectDispose?.dispose()

  const effectDispose = node.dispose.child()

  node.dependenciesEffectDispose = effectDispose

  createDependenciesEffect({
    context,
    taskId: `field:${node.id}:dependencies`,
    node,
    runtimeState,
    scope: effectDispose,
  })

  effectDispose.add(() => {
    if (node.dependenciesEffectDispose === effectDispose) {
      node.dependenciesEffectDispose = null
    }
  })
}

/** 仅 dependencies 对象 identity 或触发字段集合变化时重建 effect。 */
function shouldRecreateDependenciesEffect<TValues extends Values>(
  previous: FieldDynamicProps<TValues> | null | undefined,
  next: FieldDynamicProps<TValues> | null
): boolean {
  if (previous?.dependencies !== next?.dependencies) {
    return true
  }

  return !areNamePathListsEqual(previous?.triggerFields ?? [], next?.triggerFields ?? [])
}

/**
 * 写入字段初始值。
 *
 * 如果 descriptor.staticSchema 中定义了 initialValue 且当前字段值
 * 尚未设置，则写入该初始值。仅在首次挂载时生效。
 *
 * @typeParam TValues - 表单值类型
 * @param descriptor - 字段 descriptor
 * @param context - 运行时上下文
 */
function applyFieldInitialValue<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (!Object.hasOwn(node.staticSchema, "initialValue")) {
    return
  }

  const values = context.model

  if (values.getFieldValue(node.name) !== undefined) {
    return
  }

  const initialValue = node.staticSchema.initialValue as never

  const initialValues = {} as Partial<TValues>

  setByPath<TValues, NamePath<TValues>, never>(initialValues, node.name, initialValue)
  values.setInitialValues(initialValues)
  values.setFieldValue(node.name, initialValue)
}
