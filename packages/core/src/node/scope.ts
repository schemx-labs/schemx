/**
 * Scope - 资源生命周期边界。
 *
 * Scope 管理 cleanup 的注册、嵌套 scope、dispose 执行。
 * 规则：
 * - dispose 幂等
 * - 子 scope 先释放，父 scope 后释放
 * - cleanup 抛错不阻断后续 cleanup
 * - disposed 后 add() 立即执行 cleanup 并返回已释放 handle
 *
 * @module core/node/scope
 */

/**
 * Scope 执行的清理函数。
 */
export type ScopeCleanup = () => void

interface ScopeCleanupRecord {
  cleanup: ScopeCleanup
  disposed: boolean
}

/**
 * cleanup 注册后的释放句柄。
 *
 * @remarks
 * 调用 `dispose()` 会立即执行对应 cleanup，并阻止它在 scope dispose 时再次执行。
 */
export interface ScopeCleanupHandle {
  /** cleanup 是否已经执行或取消。 */
  readonly disposed: boolean

  /** 执行并移除当前 cleanup。 */
  dispose(): void
}

/**
 * 资源生命周期作用域。
 *
 * @remarks
 * Scope 支持嵌套生命周期：父 scope dispose 时会先 dispose 子 scope，再按注册逆序
 * 执行自身 cleanup。cleanup 抛错会被捕获并上报，不会阻断后续清理。
 */
export interface Scope {
  /** 当前 scope 是否已经释放。 */
  readonly disposed: boolean

  /**
   * 注册释放函数。
   *
   * 如果 scope 已 disposed，立即执行 cleanup 并返回已释放 handle。
   *
   * @param cleanup - 释放函数
   * @returns 可取消的释放句柄
   */
  add(cleanup: ScopeCleanup): ScopeCleanupHandle

  /**
   * 创建子 scope。
   *
   * 子 scope 的 dispose 会在父 scope dispose 前执行。
   *
   * @returns 子 scope 实例
   */
  child(): Scope

  /**
   * 释放当前 scope 及所有子 scope。
   *
   * 幂等操作，重复调用不执行任何操作。
   */
  dispose(): void
}

/**
 * 创建一个资源生命周期作用域。
 *
 * @returns 新创建的 `Scope`。
 *
 * @remarks
 * 已释放的 scope 再调用 `add()` 时会立即执行 cleanup，这让调用方无需为异步
 * mount 流程额外判断资源是否已经过期。
 */
export function createScope(): Scope {
  let disposed = false
  const cleanupRecords: ScopeCleanupRecord[] = []
  const childScopes: Scope[] = []

  /**
   * 注册释放函数。
   */
  const add = (cleanup: ScopeCleanup): ScopeCleanupHandle => {
    if (disposed) {
      // 已释放的 scope 不再持有新资源，直接执行 cleanup 保持调用方语义稳定。
      runCleanup(cleanup)

      return createDisposedHandle()
    }

    // 每次 add 都创建独立记录；同一个 cleanup 函数重复注册也应独立释放。
    const record: ScopeCleanupRecord = {
      cleanup,
      disposed: false,
    }
    cleanupRecords.push(record)

    /**
     * 立即释放当前 cleanup 记录并从 scope 中移除。
     */
    const disposeCleanup = (): void => {
      if (record.disposed) {
        return
      }

      record.disposed = true
      removeItem(cleanupRecords, record)
      runCleanup(record.cleanup)
    }

    return {
      get disposed() {
        return record.disposed
      },
      dispose: disposeCleanup,
    }
  }

  /**
   * 创建子 scope。
   */
  const child = (): Scope => {
    const childScope = createScope()
    childScopes.push(childScope)

    // 子 scope 可能被调用方提前释放；提前释放后从父 scope 中摘除，
    // 避免父 scope 后续 dispose 时继续保留无效引用。
    childScope.add(() => {
      removeItem(childScopes, childScope)
    })

    return childScope
  }

  /**
   * 释放当前 scope 及所有子 scope。
   */
  const disposeScope = (): void => {
    if (disposed) {
      return
    }

    disposed = true

    // 先释放子 scope，确保叶子资源早于父级资源清理。
    for (const childScope of childScopes.slice().reverse()) {
      childScope.dispose()
    }

    childScopes.length = 0

    // 再按 LIFO 顺序释放当前 scope 自己注册的 cleanup。
    for (const record of cleanupRecords.slice().reverse()) {
      if (!record.disposed) {
        record.disposed = true
        runCleanup(record.cleanup)
      }
    }

    cleanupRecords.length = 0
  }

  return {
    get disposed() {
      return disposed
    },
    add,
    child,
    dispose: disposeScope,
  }
}

/**
 * `createScope` 的兼容别名。
 */
export const createRuntimeScope = createScope

const createDisposedHandle = (): ScopeCleanupHandle => {
  return {
    disposed: true,
    dispose: noop,
  }
}

const noop = (): void => {}

const removeItem = <T>(items: T[], item: T): void => {
  const index = items.indexOf(item)
  if (index >= 0) {
    items.splice(index, 1)
  }
}

const runCleanup = (cleanup: ScopeCleanup): void => {
  try {
    cleanup()
  } catch (error) {
    reportRuntimeCleanupError(error)
  }
}

/**
 * 报告 cleanup 错误。
 *
 * @remarks
 * Scope 会吞掉 cleanup 抛出的错误以保证后续清理继续执行；这个函数是统一的
 * 错误上报出口。
 *
 * @param error - cleanup 抛出的错误。
 */
export function reportRuntimeCleanupError(error: unknown): void {
  console.error("[Scope] Cleanup error:", error)
}
