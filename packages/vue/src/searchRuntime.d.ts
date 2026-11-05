import type { PublicProps, VNode } from "vue"

import type { SchemxSearchProps } from "./types"
import type { Values } from "@schemx/core"

/**
 * 搜索组件的模型更新事件。
 * @typeParam TValues - 搜索条件类型。
 */
interface SchemxSearchEvents<TValues extends Values> {
  /**
   * 内部表单值变化时接收最新快照。
   * @param value - 当前完整搜索条件。
   */
  "onUpdate:modelValue"?: (value: TValues) => unknown
}

/**
 * 保留 search.vue 的泛型调用签名。
 * @typeParam TValues - 搜索条件类型。
 * @param props - 搜索配置与 Vue 模型事件。
 * @example SchemxSearch<{ keyword: string }>({ modelValue: { keyword: "" } })
 */
declare const SchemxSearch: <TValues extends Values = Values>(
  props: PublicProps & SchemxSearchProps<TValues> & SchemxSearchEvents<TValues>
) => VNode

export default SchemxSearch
