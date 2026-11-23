/**
 * 框架无关的 reactive batch 门面。
 *
 * 所有批量响应式写入都通过这里进入底层实现，避免业务模块直接依赖 Preact signals。
 *
 * @module core/reactivity/batch
 */

import { batch } from "@preact/signals-core"

/**
 * 将多次 signal 写入合并到一次通知周期中。
 *
 * @param fn - 需要批量执行的响应式写入逻辑。
 */
export function batchUpdates(fn: () => void): void {
  batch(fn)
}
