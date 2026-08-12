/**
 * useViewSchemas - Vue ViewSchemas bridge.
 *
 * @module hooks/useViewSchemas
 */

import { computed, onScopeDispose, shallowRef } from "vue"
import type { ComputedRef, ShallowRef } from "vue"

import {
  isViewGroupSchema,
  type SchemxInstance,
  type SchemxViewSchema,
  type Values,
} from "@schemx/core"

import { getCoreForm } from "../formBridge"

/**
 * 同一表单内共享的 ViewSchema 响应式桥接。
 */
interface ViewSchemaBridge<TValues extends Values = Values> {
  /**
   * 当前桥接的使用者注册数；最后一个使用者释放后才取消订阅。
   */
  refCount: number
  /**
   * 按 schema key 建立的共享索引。
   */
  schemasByKey: ComputedRef<ReadonlyMap<string, SchemxViewSchema<TValues>>>
  /**
   * 取消 Core ViewSchema 订阅。
   */
  unsubscribe: () => void
  /**
   * 最新的 ViewSchema 列表。
   */
  viewSchemas: ShallowRef<readonly SchemxViewSchema<TValues>[]>
}

/**
 * 按表单实例复用订阅，避免每个 FormItem 重复桥接同一份 ViewSchema。
 */
const viewSchemaBridgeCache = new WeakMap<object, ViewSchemaBridge>()

/**
 * 将表单 ViewSchema 映射为共享的 Vue 响应式引用。
 *
 * 当前作用域释放一个桥接使用者；所有使用者都释放后才取消 Core 订阅。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要订阅的表单实例。
 * @returns 当前 ViewSchema 列表的共享响应式浅引用；调用方不应直接改写其值。
 *
 * @example
 * ```ts
 * const form = useForm()
 * const viewSchemas = useViewSchemas(form)
 *
 * watchEffect(() => console.log(viewSchemas.value))
 * ```
 */
export function useViewSchemas<TValues extends Values = Values>(
  form: SchemxInstance<TValues>
): ShallowRef<readonly SchemxViewSchema<TValues>[]> {
  const bridge = acquireViewSchemaBridge(getCoreForm(form))

  return bridge.viewSchemas
}

/**
 * 获取指定 key 的响应式 ViewSchema，并复用当前表单的共享订阅。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要读取的表单实例。
 * @param getKey - 返回当前 schema key 的响应式 getter。
 * @returns 对应的最新 ViewSchema；不存在时返回 undefined。
 *
 * @example
 * ```ts
 * const schema = useViewSchema(form, () => fieldKey)
 *
 * watchEffect(() => {
 *   console.log(schema.value?.label)
 * })
 * ```
 */
export function useViewSchema<TValues extends Values = Values>(
  form: SchemxInstance<TValues>,
  getKey: () => string
): ComputedRef<SchemxViewSchema<TValues> | undefined> {
  const bridge = acquireViewSchemaBridge(getCoreForm(form))

  return computed(() => bridge.schemasByKey.value.get(getKey()))
}

/**
 * 创建一个表单级 ViewSchema 桥接。
 *
 * @param form - 用于提供 ViewSchema 和订阅更新的 Core 表单实例。
 */
function createViewSchemaBridge<TValues extends Values>(
  form: SchemxInstance<TValues>
): ViewSchemaBridge<TValues> {
  const viewSchemas = shallowRef<readonly SchemxViewSchema<TValues>[]>(
    form.getViewSchemas()
  )

  const schemasByKey = computed<ReadonlyMap<string, SchemxViewSchema<TValues>>>(() => {
    return createViewSchemaIndex(viewSchemas.value)
  })

  const unsubscribe = form.subscribeViewSchemas(
    /**
     * 接收 Core 发布的完整列表并替换共享引用，以保留更新边界。
     *
     * @param nextSchemas - Core 计算出的最新 ViewSchema 列表。
     */
    (nextSchemas) => {
      viewSchemas.value = nextSchemas
    }
  )

  return {
    refCount: 0,
    schemasByKey,
    unsubscribe,
    viewSchemas,
  }
}

/**
 * 获取共享桥接，并把使用权绑定到当前 Vue effect scope。
 *
 * @param form - 用于查找或创建共享桥接的 Core 表单实例。
 */
function acquireViewSchemaBridge<TValues extends Values>(
  form: SchemxInstance<TValues>
): ViewSchemaBridge<TValues> {
  const cachedBridge = viewSchemaBridgeCache.get(form) as
    ViewSchemaBridge<TValues> | undefined

  const bridge = cachedBridge ?? createViewSchemaBridge(form)

  if (!cachedBridge) {
    viewSchemaBridgeCache.set(form, bridge as ViewSchemaBridge)
  }

  bridge.refCount++

  onScopeDispose(() => {
    bridge.refCount--

    if (bridge.refCount > 0) {
      return
    }

    bridge.unsubscribe()
    viewSchemaBridgeCache.delete(form)
  })

  return bridge
}

/**
 * 递归索引顶层和分组内的 ViewSchema，供任意 FormItem 按 key 查询。
 *
 * @param viewSchemas - 待索引的顶层 ViewSchema 列表。
 * @returns 按 schema key 建立的只读索引。
 */
function createViewSchemaIndex<TValues extends Values>(
  viewSchemas: readonly SchemxViewSchema<TValues>[]
): ReadonlyMap<string, SchemxViewSchema<TValues>> {
  const schemasByKey = new Map<string, SchemxViewSchema<TValues>>()

  /**
   * 将当前层及其分组子节点追加到索引。
   *
   * @param schemas - 当前层待追加的 ViewSchema 列表。
   */
  const appendSchemas = (schemas: readonly SchemxViewSchema<TValues>[]): void => {
    for (const schema of schemas) {
      schemasByKey.set(schema.key, schema)

      if (isViewGroupSchema(schema)) {
        appendSchemas(schema.children)
      }
    }
  }

  appendSchemas(viewSchemas)

  return schemasByKey
}

export default useViewSchemas
