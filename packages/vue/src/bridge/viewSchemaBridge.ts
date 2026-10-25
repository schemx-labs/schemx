/**
 * 将 Core ViewSchema 列表投影为共享的 Vue 状态。
 *
 * @module vue/bridge/viewSchemaBridge
 */

import { computed, shallowRef } from "vue"

import { isViewDynamicSchema, isViewGroupSchema } from "@schemx/core"

import type { VueViewSchemaState } from "./index"
import type { SchemxInstance, SchemxViewSchema, Values } from "@schemx/core"

/**
 * 创建一个 Form 的共享 ViewSchema 状态。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要订阅 ViewSchema 的 Core Form。
 * @returns 当前 Form 的 ViewSchema 列表、索引和释放方法。
 *
 * @example
 * ```ts
 * const state = createVueViewSchemaState(form)
 * const current = state.viewSchemas.value
 * state.dispose()
 * ```
 */
export function createVueViewSchemaState<TValues extends Values>(
  form: SchemxInstance<TValues>
): VueViewSchemaState<TValues> {
  // 保留 Core 列表引用，避免 Vue 深层代理改变 Schema 快照的读取方式。
  const viewSchemas = shallowRef<readonly SchemxViewSchema<TValues>[]>(
    form.getViewSchemas()
  )

  // 索引随列表惰性重建；Schema key 用于查询，不承担组件节点身份。
  const schemasByKey = computed<ReadonlyMap<string, SchemxViewSchema<TValues>>>(() => {
    return createViewSchemaIndex(viewSchemas.value)
  })

  // 当前资源周期只持有这一份 ViewSchema 订阅。
  const unsubscribe = form.subscribeViewSchemas(
    /**
     * 发布 Core 已解析的完整视图，交给 Vue 计算索引和更新渲染。
     * @param nextSchemas - Core 最新的 ViewSchema 列表。
     */
    (nextSchemas) => {
      viewSchemas.value = nextSchemas
    }
  )

  // 允许多个清理入口重复释放同一订阅。
  let disposed = false

  // 取消后保留最后一次列表值，不再接收 Core 更新。
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    unsubscribe()
  }

  return {
    schemasByKey,
    viewSchemas,
    dispose,
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
