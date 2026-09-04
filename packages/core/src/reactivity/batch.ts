/**
 * 框架无关的 reactive batch 门面。
 *
 * 所有批量响应式写入都通过这里进入底层实现，避免业务模块直接依赖 Preact signals。
 *
 * @module core/reactivity/batch
 */

import { batch } from "@preact/signals-core"

/**
 * 保存最外层 batch 完成后需要通知的监听器。
 */
const batchCompleteListeners = new Set<() => void>()

/**
 * 当前嵌套 batch 的层级，只有回到零层时才发出完成通知。
 */
let batchDepth = 0

/**
 * 将多次 signal 写入合并到一次通知周期中。
 *
 * @param fn - 需要批量执行的响应式写入逻辑。
 *
 * @example
 * ```ts
 * batchUpdates(() => {
 *   first.value = 1
 *   second.value = 2
 * })
 * ```
 */
export function batchUpdates(fn: () => void): void {
  batchDepth += 1

  batch(() => {
    try {
      fn()
    } finally {
      batchDepth -= 1

      if (batchDepth === 0) {
        for (const listener of batchCompleteListeners) {
          listener()
        }
      }
    }
  })
}

/**
 * 在最外层响应式 batch 完成后执行回调。
 *
 * 仅供需要将多个字段写入聚合为一次领域状态提交的内部模块使用。
 *
 * @param listener - batch 完成后接收通知的回调。
 * @returns 取消该监听的函数；可重复调用。
 *
 * @example
 * ```ts
 * const unsubscribe = onBatchComplete(() => {
 *   flushPendingChanges()
 * })
 *
 * unsubscribe()
 * ```
 */
export function onBatchComplete(listener: () => void): () => void {
  batchCompleteListeners.add(listener)

  return () => {
    batchCompleteListeners.delete(listener)
  }
}
