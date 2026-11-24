import { isEqual } from "es-toolkit/compat"

import { collectObjectPathsByLeaf, diff } from "../utils"
import { visitObjectLeaves } from "../utils/path"

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
 * 收集可能变化的顶层分支中的叶子，同时保留实际存在的 undefined。
 * @param snapshot - 要读取叶子的当前或上一轮快照。
 * @param other - 用于判断顶层属性是否增删的另一份快照。
 * @param changed - 现有 onValuesChange 使用的顶层差异。
 */
function collectChangedBranchLeaves<TValues extends Values>(
  snapshot: TValues,
  other: TValues,
  changed: Partial<TValues>
): Map<string, unknown> {
  // 只展开有变化的顶层分支，避免遍历表单的其他子树。
  const branches = Object.fromEntries(
    // key 为快照的顶层属性。
    Object.entries(snapshot).filter(
      ([key]) => Object.hasOwn(changed, key) || !Object.hasOwn(other, key)
    )
  )

  // 完整路径关联该快照中实际存在的叶子值。
  const leaves = new Map<string, unknown>()

  // path 为完整字段路径，value 为该快照中的实际叶子值。
  visitObjectLeaves(branches, (path, value) => leaves.set(path, value))

  return leaves
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

    // 字段变化按叶子比较，值回调继续接收原有顶层变化片段。
    const changedPaths: TName[] = []

    if (callbacks.onFieldsChange) {
      // 前后快照中的受影响叶子，查不到键表示路径不存在。
      const previousLeaves = collectChangedBranchLeaves(
        prevSnapshot,
        latestSnapshot,
        changedValues
      )

      const latestLeaves = collectChangedBranchLeaves(
        latestSnapshot,
        prevSnapshot,
        changedValues
      )

      for (const [path, value] of latestLeaves) {
        if (!previousLeaves.has(path) || !isEqual(previousLeaves.get(path), value)) {
          changedPaths.push(path as TName)
        }
      }

      for (const path of previousLeaves.keys()) {
        if (!latestLeaves.has(path)) {
          changedPaths.push(path as TName)
        }
      }
    }

    // 回调可再次写值，先记录本轮已交付的基准。
    prevSnapshot = latestSnapshot
    if (callbacks.onValuesChange && collectObjectPathsByLeaf(changedValues).length > 0) {
      callbacks.onValuesChange(changedValues, latestSnapshot)
    }

    if (changedPaths.length > 0) {
      callbacks.onFieldsChange?.(
        changedPaths,
        collectObjectPathsByLeaf<TValues, TName>(latestSnapshot)
      )
    }
  })
}
