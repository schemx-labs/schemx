/**
 * 将 Core ViewSchema 列表投影为共享的 Vue 状态。
 *
 * @module vue/bridge/viewSchemaBridge
 */

import { computed } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"

import type { VueStateBridge, VueViewSchemaState } from "./index"
import type { FormStateAdapter, SchemxViewSchema, Values } from "@schemx/core"

/**
 * 创建一个 Form 的共享 ViewSchema 状态。
 *
 * @typeParam TValues - 表单值类型。
 * @param adapter - 当前资源周期的 Core adapter。
 * @param states - 同周期共享的 Vue 来源投影。
 * @returns 当前 Form 的 ViewSchema 列表与索引；订阅由 states 统一释放。
 *
 * @example
 * ```ts
 * const state = createVueViewSchemaState(adapter, states)
 * const current = state.viewSchemas.value
 * // 订阅由所属 states 统一释放。
 * ```
 */
export function createVueViewSchemaState<TValues extends Values>(
  adapter: FormStateAdapter<TValues>,
  states: VueStateBridge
): VueViewSchemaState<TValues> {
  // adapter 保留原始 Schema 引用；按既有渲染契约读取，不更改组件定义身份。
  const viewSchemas = states.bind(
    adapter.viewSchemas
  ) as VueViewSchemaState<TValues>["viewSchemas"]

  // 索引随列表惰性重建；Schema key 用于查询，不承担组件节点身份。
  const schemasByKey = computed<ReadonlyMap<string, SchemxViewSchema<TValues>>>(() => {
    return createViewSchemaIndex(viewSchemas.value)
  })

  return {
    schemasByKey,
    viewSchemas,
  }
}

/**
 * 递归索引顶层、Group 子级及 Dynamic 数组行内的 ViewSchema。
 *
 * @param viewSchemas - 待索引的 ViewSchema 列表。
 * @returns 按 key 建立的 ViewSchema 索引。
 */
function createViewSchemaIndex<TValues extends Values>(
  viewSchemas: readonly SchemxViewSchema<TValues>[]
): ReadonlyMap<string, SchemxViewSchema<TValues>> {
  // 汇集跨容器的当前 key 供字段查询；同名项以后遍历的节点为准。
  const schemasByKey = new Map<string, SchemxViewSchema<TValues>>()

  /**
   * 递归写入当前层级及其嵌套子节点的 ViewSchema 索引。
   *
   * @param schemas - 当前层级的 ViewSchema 列表。
   */
  const appendSchemas = (schemas: readonly SchemxViewSchema<TValues>[]): void => {
    // 所有容器自身也入索引，子节点继续沿实际视图层级展开。
    for (const schema of schemas) {
      schemasByKey.set(schema.key, schema)

      if (isViewGroupSchema(schema)) {
        appendSchemas(schema.children)
      } else if (isViewDynamicSchema(schema)) {
        // 行身份只负责渲染分组，索引的是行内实际 Schema 节点。
        for (const item of schema.items) {
          appendSchemas(item.children)
        }
      }
    }
  }

  appendSchemas(viewSchemas)

  return schemasByKey
}
