/**
 * 缓存 Store 的完整值快照，并按 batch revision 管理失效。
 */
import { createSignal, onBatchComplete } from "../reactivity"

import type { NamePath, Values } from "../types"

/**
 * 构建当前完整表单值快照的回调。
 */
type SnapshotBuilder<TValues extends Values> = () => TValues

/**
 * 管理完整值快照的 revision、失效和 batch 提交。
 */
class StoreSnapshotImpl<TValues extends Values> {
  /**
   * 在响应式系统中记录值变更 revision。
   */
  private readonly valueRevision = createSignal(0)
  /**
   * 保存当前 batch 内发生变化的路径，避免重复提交 revision。
   */
  private readonly changedPaths = new Set<NamePath<TValues>>()
  /**
   * 快照缓存对应的 revision。
   */
  private snapshotRevision = -1
  /**
   * 当前 revision 可复用的完整快照。
   */
  private snapshotCache: TValues | undefined
  /**
   * 注销 batch 完成监听的函数。
   */
  private readonly disposeBatchListener: () => void

  /**
   * 注册 batch 完成监听，并初始化快照缓存状态。
   */
  constructor() {
    this.disposeBatchListener = onBatchComplete(() => {
      this.commitValueChanges()
    })
  }

  /**
   * 记录当前 batch 的值或字段结构变化。
   *
   * @param path 发生值或结构变化的字段路径。
   */
  markValueChanged(path: NamePath<TValues>): void {
    this.changedPaths.add(path)
    this.snapshotRevision = -1
  }

  /**
   * 返回当前 revision 的完整快照，未命中缓存时才执行构建回调。
   *
   * @param buildSnapshot 用于构建完整快照的回调。
   * @returns 当前 revision 对应的完整表单值。
   */
  read(buildSnapshot: SnapshotBuilder<TValues>): TValues {
    const revision = this.valueRevision.peek()

    if (this.snapshotRevision === revision && this.snapshotCache) {
      return this.snapshotCache
    }

    const snapshot = buildSnapshot()

    this.snapshotRevision = revision
    this.snapshotCache = snapshot

    return snapshot
  }

  /**
   * 释放 batch 监听、路径变更记录和快照缓存。
   */
  destroy(): void {
    this.disposeBatchListener()
    this.changedPaths.clear()
    this.snapshotCache = undefined
    this.snapshotRevision = -1
  }

  /**
   * 在 batch 完成后将路径变更提交为新的快照 revision。
   */
  private commitValueChanges(): void {
    if (this.changedPaths.size === 0) return

    this.changedPaths.clear()
    this.snapshotRevision = -1
    this.valueRevision.value += 1
  }
}

/**
 * 暴露完整快照管理器的内部能力，不暴露其构造方式。
 */
export type StoreSnapshot<TValues extends Values> = StoreSnapshotImpl<TValues>

/**
 * 创建完整值快照管理器。
 *
 * @typeParam TValues 表单值对象类型。
 * @returns 可供 Store 组合根使用的快照管理器。
 * @example
 * ```ts
 * const snapshot = createStoreSnapshot<FormValues>()
 * ```
 */
export function createStoreSnapshot<TValues extends Values>(): StoreSnapshot<TValues> {
  return new StoreSnapshotImpl<TValues>()
}
