/**
 * ViewRevision - 视图结构版本追踪。
 *
 * Reconciler 和 DependencyEffectSlot 在修改 RuntimeNode 树结构时推进 revision，
 * subscribeViewSchemas 读取此 revision 以追踪结构变化。
 *
 * @module core/view/viewRevision
 */

import { createSignal } from "../reactivity"

import type { Signal } from "../reactivity"

/**
 * 视图结构版本追踪器。
 */
export interface ViewRevision {
  /**
   * 当前 revision 信号。
   */
  readonly revision: Signal<number>

  /**
   * 推进 revision。
   */
  bump(): void
}

/**
 * 创建一个 ViewRevision 实例。
 *
 * @returns 新创建的 ViewRevision
 */
export function createViewRevision(): ViewRevision {
  const revision = createSignal(0)

  /**
   * 推进视图结构版本，触发依赖 revision 的视图订阅重新计算。
   */
  const bump = (): void => {
    revision.value += 1
  }

  return {
    revision,
    bump,
  }
}
