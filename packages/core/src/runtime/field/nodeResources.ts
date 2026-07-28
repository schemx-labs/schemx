/**
 * NodeResources - 字段运行时节点的资源挂载与更新。
 *
 * 管理 FieldRuntimeNode 的生命周期：创建字段运行态、视图状态、注册字段索引、
 * 创建校验和 dependencies effect。
 *
 * @module core/runtime/field/nodeResources
 */

import { setByPath } from "../../utils"
import { createInheritedContainerState } from "../container/runtimeState"
import { createRuntimeViewState, updateRuntimeViewState } from "../view/createViewState"

import { createDependenciesEffect } from "./dependenciesEffect"
import { createFieldRuntimeState, setFieldStaticSchema } from "./runtimeState"
import { createValidationEffect } from "./validationEffect"

import type { NamePath, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { FieldDescriptor } from "../descriptor"
import type { FieldRuntimeNode } from "../node"
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
export function mountFieldNodeResources<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  descriptor: FieldDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const resources = context.nodeResources

  const runtimeState = createFieldRuntimeState<TValues>({
    nodeId: node.id,
    key: node.key,
    descriptor,
    inheritedState: createInheritedContainerState(node),
  })

  applyFieldInitialValue(descriptor, context)
  node.fieldState = runtimeState
  createRuntimeViewState(node, descriptor, resources)
  resources.fieldIndex.register(node)
  recreateFieldEffects(node, descriptor, runtimeState, context)
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
export function updateFieldNodeResources<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  previousDescriptor: FieldDescriptor<TValues> | undefined,
  nextDescriptor: FieldDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const resources = context.nodeResources

  const runtimeState = node.fieldState

  if (!runtimeState) {
    mountFieldNodeResources(node, nextDescriptor, context)

    return
  }

  if (previousDescriptor && previousDescriptor.name !== nextDescriptor.name) {
    resources.fieldIndex.unregister(node)
  }

  setFieldStaticSchema(runtimeState, nextDescriptor)
  updateRuntimeViewState(node, nextDescriptor, resources)
  resources.fieldIndex.register(node)
  recreateFieldEffects(node, nextDescriptor, runtimeState, context)
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
export function unmountFieldNodeResources<TValues extends Values>(
  node: FieldRuntimeNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const resources = context.nodeResources

  resources.fieldIndex.unregister(node)
  node.effectDispose?.dispose()
  node.effectDispose = null
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
  descriptor: FieldDescriptor<TValues>,
  runtimeState: FieldRuntimeState<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  node.effectDispose?.dispose()

  const effectDispose = node.dispose.child()

  node.effectDispose = effectDispose

  createValidationEffect({
    context,
    name: descriptor.name,
    effectiveSchema: runtimeState.effectiveSchema,
    scope: effectDispose,
  })
  createDependenciesEffect({
    context,
    taskId: `field:${node.id}:dependencies`,
    descriptor,
    runtimeState,
    scope: effectDispose,
  })

  effectDispose.add(() => {
    if (node.effectDispose === effectDispose) {
      node.effectDispose = null
    }
  })
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
  descriptor: FieldDescriptor<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  if (!Object.hasOwn(descriptor.staticSchema, "initialValue")) {
    return
  }

  const values = context.model

  if (values.getFieldValue(descriptor.name) !== undefined) {
    return
  }

  const initialValue = descriptor.staticSchema.initialValue as never

  const initialValues = {} as Partial<TValues>

  setByPath<TValues, NamePath<TValues>, never>(
    initialValues,
    descriptor.name,
    initialValue
  )
  values.setInitialValues(initialValues)
  values.setFieldValue(descriptor.name, initialValue)
}
