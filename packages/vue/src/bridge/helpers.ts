/**
 * Vue Runtime 使用的 Ref 和快照比较工具。
 *
 * @module vue/bridge/helpers
 */

import { shallowRef } from "vue"
import type { ShallowRef } from "vue"

import type { SnapshotSource } from "@schemx/core/adapter"

/**
 * 创建类型为 `ShallowRef` 的 Vue 浅层 Ref。
 *
 * 运行时直接委托 Vue 的 `shallowRef`，类型断言用于保留 Runtime 对快照引用的控制。
 *
 * @typeParam TValue - Ref 中保存的值类型。
 * @param value - 要包装为 shallow Ref 的当前值。
 * @returns 包装后的 shallow Ref。
 *
 * @example
 * ```ts
 * const ready = createVueShallowRef(false)
 * ready.value = true
 * ```
 */
export function createVueShallowRef<TValue>(value: TValue): ShallowRef<TValue> {
  return shallowRef(value) as ShallowRef<TValue>
}

/**
 * 将 Core SnapshotSource 绑定为 Vue shallow Ref。
 *
 * SnapshotSource 的生命周期由所属 FormStateAdapter 统一管理；这里仅保留
 * 同步逻辑，避免每个 Form 级来源重复声明一套订阅函数。
 *
 * @param source - 提供快照和订阅能力的 Core Source。
 * @returns 与 Source 当前快照同步的 Vue shallow Ref。
 *
 * @example
 * ```ts
 * const values = bindSnapshotSource(stateAdapter.values)
 * ```
 */
export function bindSnapshotSource<TValue>(
  source: SnapshotSource<TValue>
): ShallowRef<TValue> {
  const value = createVueShallowRef(source.getSnapshot())

  source.subscribe(() => {
    value.value = source.getSnapshot()
  })

  return value
}

/**
 * 比较两份错误消息列表，避免无变化时写入 Vue Ref。
 *
 * @param previous - 当前 Ref 中保存的错误消息列表。
 * @param next - SnapshotSource 返回的最新错误消息列表。
 * @returns 两个列表的长度和每一项都相同时返回 `true`。
 *
 * @example
 * ```ts
 * const changed = !areStringListsEqual(previous, next)
 * ```
 */
export function areStringListsEqual(
  previous: readonly string[],
  next: readonly string[]
): boolean {
  return (
    previous.length === next.length &&
    previous.every((value, index) => value === next[index])
  )
}
