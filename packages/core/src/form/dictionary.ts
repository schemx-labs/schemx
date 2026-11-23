/**
 * 字段字典实例方法。
 *
 * 所有操作按路径解析当前活动字段节点，再转发到节点的字典 channel。
 * 因此字段改名、数组行移动后无需额外的地址簿维护。
 *
 * @module core/form/dictionary
 */

import { isFieldNode } from "../node"

import type { FieldDictionaryChannel, FieldDictionaryResult } from "../dictionary/types"
import type { NodeManager } from "../node"
import type { NamePath, SchemxInstance, Values } from "../types"

/**
 * 实例上暴露的六个字典方法。
 *
 * @typeParam TValues - 表单值类型。
 */
export type FormDictionaryApi<TValues extends Values = Values> = Pick<
  SchemxInstance<TValues>,
  | "getFieldDict"
  | "getFieldDictOptions"
  | "loadFieldDict"
  | "refreshFieldDict"
  | "cancelFieldDict"
  | "setFieldDictOptions"
>

/**
 * 字典实例方法需要的节点索引与生命周期。
 *
 * @typeParam TValues - 表单值类型。
 */
interface FormDictionaryContext<TValues extends Values> {
  /**
   * 活动节点索引。
   */
  nodeManager: NodeManager<TValues>
  /**
   * 表单是否已销毁。
   */
  isDisposed: () => boolean
}

/**
 * 无字典运行态时复用同一个空列表。
 */
const EMPTY_OPTIONS: readonly unknown[] = Object.freeze([])

/**
 * 创建按当前路径操作字典的实例方法。
 *
 * @typeParam TValues - 表单值类型。
 * @param context - 节点索引与表单终态。
 * @returns 六个扁平的字典方法。
 * @example createFormDictionary({ nodeManager, isDisposed })
 */
export function createFormDictionary<TValues extends Values>(
  context: FormDictionaryContext<TValues>
): FormDictionaryApi<TValues> {
  /**
   * 解析路径上的全部活动字段字典；同路径可能存在多个节点身份。
   * @param name - 字段当前路径。
   */
  const channelsOf = (name: NamePath<TValues>): readonly FieldDictionaryChannel[] => {
    // 当前路径命中的全部字典资源。
    const channels: FieldDictionaryChannel[] = []

    // id 是当前路径下的节点身份。
    for (const id of context.nodeManager.getNodeIds(name)) {
      // 当前活动节点。
      const node = context.nodeManager.get(id)

      // 资源引用可观察，允许同一节点运行中启停字典。
      const channel = node && isFieldNode(node) ? node.dictionary.value : null

      if (channel) {
        channels.push(channel)
      }
    }

    return channels
  }

  /**
   * 返回首个字典的请求；没有字典时返回 unregistered。
   * @param pending - 同路径各字典已启动的请求。
   */
  const firstPending = (
    pending: readonly Promise<FieldDictionaryResult>[]
  ): Promise<FieldDictionaryResult> =>
    pending[0] ?? Promise.resolve({ ok: false, reason: "unregistered" })

  /**
   * 对路径上的全部字典执行同一同步操作。
   * @param name - 字段当前路径。
   * @param run - 接收单个 channel 并执行修改的回调。
   * @returns 是否至少命中一个字典。
   */
  const forEach = (
    name: NamePath<TValues>,
    run: (channel: FieldDictionaryChannel) => void
  ): boolean => {
    // 本次路径解析得到的字典资源。
    const channels = channelsOf(name)

    channels.forEach(run)

    return channels.length > 0
  }

  /**
   * 读取第一个字典的选项和请求状态。
   * @param name - 字段当前路径。
   */
  const getFieldDict: FormDictionaryApi<TValues>["getFieldDict"] = (name) =>
    channelsOf(name)[0]?.snapshot()

  /**
   * 仅读取第一个字典的当前选项。
   * @param name - 字段当前路径。
   */
  const getFieldDictOptions: FormDictionaryApi<TValues>["getFieldDictOptions"] = (name) =>
    channelsOf(name)[0]?.options() ?? EMPTY_OPTIONS

  /**
   * 按需加载路径上的字典，复用成功结果或在途请求。
   * @param name - 字段当前路径。
   */
  const loadFieldDict: FormDictionaryApi<TValues>["loadFieldDict"] = (name) => {
    if (context.isDisposed()) {
      return Promise.resolve({ ok: false, reason: "disposed" })
    }

    // channel 是该路径下的字典运行态。
    return firstPending(channelsOf(name).map((channel) => channel.load()))
  }

  /**
   * 刷新路径上的字典，以远端结果覆盖当前选项。
   * @param name - 字段当前路径。
   */
  const refreshFieldDict: FormDictionaryApi<TValues>["refreshFieldDict"] = (name) => {
    if (context.isDisposed()) {
      return Promise.resolve({ ok: false, reason: "disposed" })
    }

    // channel 是该路径下的字典运行态。
    return firstPending(channelsOf(name).map((channel) => channel.refresh()))
  }

  /**
   * 取消路径上的全部字典请求。
   * @param name - 字段当前路径。
   */
  const cancelFieldDict: FormDictionaryApi<TValues>["cancelFieldDict"] = (name) => {
    // channel 是需要中止请求的字典。
    forEach(name, (channel) => channel.cancel())
  }

  /**
   * 整体替换选项或基于每个字典的当前列表计算新选项。
   * @param name - 字段当前路径。
   * @param action - 新列表或返回新列表的 updater。
   */
  const setFieldDictOptions: FormDictionaryApi<TValues>["setFieldDictOptions"] = (
    name,
    action
  ) => {
    // channel 是本次需要写入的字典。
    return forEach(name, (channel) => channel.setOptions(action))
  }

  return {
    getFieldDict,
    getFieldDictOptions,
    loadFieldDict,
    refreshFieldDict,
    cancelFieldDict,
    setFieldDictOptions,
  }
}
