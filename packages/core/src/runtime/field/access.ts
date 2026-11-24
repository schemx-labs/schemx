/** 按当前字段路径提供表单域需要的运行时读取接口。 */

import { runSignalUntracked } from "../../reactivity"
import { isFieldNode } from "../node/helper"

import type { FieldDictionaryChannel } from "../../dictionary/types"
import type { ReadonlySignal } from "../../reactivity"
import type { NamePath, Values } from "../../types"
import type { NodeManager } from "../node/nodeManager"
import type { FieldNode, ResolvedFieldSchema } from "../node/types"

/**
 * 字段交互和校验读取的有效配置。
 * @typeParam TValues - 表单值类型。
 */
export type RuntimeFieldConfig<TValues extends Values> = Pick<
  ResolvedFieldSchema<TValues>,
  | "visible"
  | "readonly"
  | "disabled"
  | "label"
  | "required"
  | "placeholder"
  | "validationTrigger"
  | "onChange"
  | "onBlur"
>

/**
 * 表单域按路径读取字段的接口。
 * @typeParam TValues - 表单值类型。
 */
export interface RuntimeFieldAccess<TValues extends Values> {
  /**
   * 读取当前挂载字段的有效配置。
   * @param name - 当前字段路径。
   */
  getFieldConfig(name: NamePath<TValues>): RuntimeFieldConfig<TValues> | undefined
  /**
   * 捕获本次操作对应的路径绑定信号。
   * @param name - 操作开始时的字段路径。
   */
  getFieldPathSignal(name: NamePath<TValues>): AbortSignal | undefined
  /**
   * 读取路径上的活动字典，包括同一路径下的多个节点身份。
   * @param name - 当前字段路径。
   */
  getFieldDictionaryChannels(name: NamePath<TValues>): readonly FieldDictionaryChannel[]
}

/**
 * 将节点身份、路径绑定与字典索引封装在运行时。
 * @typeParam TValues - 表单值类型。
 * @param nodeManager - 当前表单的节点索引。
 * @param disposed - 运行时的销毁信号。
 * @example const fields = createRuntimeFieldAccess(nodeManager, root.disposed)
 */
export function createRuntimeFieldAccess<TValues extends Values>(
  nodeManager: NodeManager<TValues>,
  disposed: ReadonlySignal<boolean>
): RuntimeFieldAccess<TValues> {
  /**
   * 按索引顺序解析当前路径的主字段节点。
   * @param name - 当前字段路径。
   */
  const getField = (name: NamePath<TValues>): FieldNode<TValues> | undefined => {
    // 路径也可能属于数组根或数组行。
    const [id] = nodeManager.getNodeIds(name)

    const node = id === undefined ? undefined : nodeManager.get(id)

    return isFieldNode(node) ? node : undefined
  }

  // name 为待读取当前配置的字段路径。
  const getFieldConfig: RuntimeFieldAccess<TValues>["getFieldConfig"] = (name) => {
    const field = getField(name)

    return field && !field.disposed.value ? field.resolvedSchema.value : undefined
  }

  // name 为当前异步操作要绑定的字段路径。
  const getFieldPathSignal: RuntimeFieldAccess<TValues>["getFieldPathSignal"] = (name) =>
    disposed.value
      ? undefined
      : runSignalUntracked(() => getField(name)?.pathController.signal)

  // name 为要查找全部字典资源的字段路径。
  const getFieldDictionaryChannels: RuntimeFieldAccess<TValues>["getFieldDictionaryChannels"] =
    (name) => {
      // 按节点索引顺序保留活动字典，供公开入口读取第一项或操作全部。
      const channels: FieldDictionaryChannel[] = []

      for (const id of nodeManager.getNodeIds(name)) {
        const node = nodeManager.get(id)

        // 响应式读取字典资源，允许字段在原节点上启停字典。
        const channel = isFieldNode(node) ? node.dictionary.value : null

        if (channel) {
          channels.push(channel)
        }
      }

      return channels
    }

  return { getFieldConfig, getFieldPathSignal, getFieldDictionaryChannels }
}
