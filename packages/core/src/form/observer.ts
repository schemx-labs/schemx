import { collectObjectPathsByLeaf, diff } from "../utils"

import type { Store } from "../store"
import type { NamePath, SchemxInstance, Values } from "../types"

/**
 * Form 值变化和字段路径变化回调。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface FormObserverCallbacks<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 值快照发生变化时触发。
   */
  onValuesChange?: (
    changedValues: Readonly<Partial<TValues>>,
    latestSnapshot: Readonly<TValues> | TValues
  ) => void
  /**
   * 叶子字段路径发生变化时触发。
   */
  onFieldsChange?: (changedFields: TName[], allFields: TName[]) => void
}

/**
 * 订阅 Store 的响应式变化并派发 Form 级回调。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 * @param store - 提供当前值和非追踪快照读取的 Store。
 * @param callbacks - 值变化与字段变化回调。
 * @param effect - Form 拥有的副作用注册入口。
 * @returns 取消订阅的函数。
 *
 * @example
 * ```ts
 * const stop = createFormObserver(store, {
 *   onValuesChange: (changedValues) => {
 *     console.log(changedValues)
 *   },
 * }, effect)
 *
 * stop()
 * ```
 */
export function createFormObserver<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  store: Store<TValues>,
  callbacks: FormObserverCallbacks<TValues, TName>,
  effect: SchemxInstance<TValues>["effect"]
): () => void {
  // 没有消费者时不创建响应式 effect。
  if (!callbacks.onValuesChange && !callbacks.onFieldsChange) {
    return () => {}
  }

  // 用于计算本轮与上一轮之间差异的值快照。
  let prevSnapshot = store.getFieldsSnapshot()

  return effect(() => {
    // 读取当前值以建立响应式依赖。
    const latestSnapshot = store.getFieldsValue()

    // 只向回调报告本轮发生变化的值。
    const changedValues = diff(latestSnapshot, prevSnapshot)

    // 将对象差异转换为叶子字段路径。
    const changedPaths = collectObjectPathsByLeaf<TValues, TName>(changedValues)

    if (changedPaths.length > 0) {
      callbacks.onValuesChange?.(changedValues, latestSnapshot)
      callbacks.onFieldsChange?.(
        changedPaths,
        collectObjectPathsByLeaf<TValues, TName>(latestSnapshot)
      )
    }

    prevSnapshot = latestSnapshot
  })
}
