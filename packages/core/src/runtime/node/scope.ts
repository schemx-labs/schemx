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
 * @module core/runtime/node/scope
 */

import type {
  RuntimeDispose,
  Scope,
  ScopeCleanup,
  ScopeCleanupHandle,
  ScopeCleanupRecord,
} from "./types"

/**
 * 创建一个资源生命周期作用域。
 *
 * 已释放的 scope 再调用 `add()` 时会立即执行 cleanup，这让调用方无需为异步
 * mount 流程额外判断资源是否已经过期。
 *
 * @returns 新创建的 `Scope`。
 *
 * @remarks
 * 内部维护 cleanupRecords 集合和 childScopes 集合。dispose 时先释放子 scope，
 * 再按 LIFO 顺序执行当前 scope 的 cleanup。cleanup 抛错会被捕获并上报，
 * 不影响后续 cleanup 执行。
 */
export function createScope(): Scope {
  let disposed = false

  const cleanupRecords = new Set<ScopeCleanupRecord>()

  const childScopes = new Set<Scope>()

  /**
   * 注册释放函数。
   *
   * 每次 add 都创建独立记录；同一个 cleanup 函数重复注册也应独立释放。
   * 返回的 handle 可提前释放该 cleanup 而不影响 scope 整体生命周期。
   *
   * @param cleanup - 释放函数
   * @returns 释放句柄，可提前执行该 cleanup
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

    cleanupRecords.add(record)

    /**
     * 立即释放当前 cleanup 记录并从 scope 中移除。
     */
    const disposeCleanup = (): void => {
      if (record.disposed) {
        return
      }

      record.disposed = true
      cleanupRecords.delete(record)
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
   *
   * 子 scope 会被父 scope 跟踪；父 scope dispose 时自动释放子 scope。
   * 子 scope 提前释放后自动从父 scope 摘除。
   *
   * @returns 子 Scope 实例
   */
  const child = (): Scope => {
    const childScope = createScope()

    if (disposed) {
      childScope.dispose()

      return childScope
    }

    childScopes.add(childScope)

    // 子 scope 可能被调用方提前释放；提前释放后从父 scope 中摘除，
    // 避免父 scope 后续 dispose 时继续保留无效引用。
    childScope.add(() => {
      childScopes.delete(childScope)
    })

    return childScope
  }

  /**
   * 释放当前 scope 及所有子 scope。
   *
   * 幂等：首次调用后 disposed 标记为 true，后续调用直接返回。
   * 释放顺序：先子后父，同层级按 LIFO。
   */
  const disposeScope = (): void => {
    if (disposed) {
      return
    }

    disposed = true

    // 先释放子 scope，确保叶子资源早于父级资源清理。
    for (const childScope of [...childScopes].reverse()) {
      childScope.dispose()
    }

    childScopes.clear()

    // 再按 LIFO 顺序释放当前 scope 自己注册的 cleanup。
    for (const record of [...cleanupRecords].reverse()) {
      if (!record.disposed) {
        record.disposed = true
        runCleanup(record.cleanup)
      }
    }

    cleanupRecords.clear()
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
 * 创建一个 Runtime 资源生命周期边界。
 *
 * `createRuntimeDispose` 是 `createScope` 的语义别名，用于在 RuntimeNode 和
 * RuntimeNodeManager 上下文中强调 dispose 语义。
 *
 * @returns RuntimeDispose 实例
 */
export function createRuntimeDispose(): RuntimeDispose {
  return createScope()
}

/**
 * `createScope` 的兼容别名。
 *
 * 在需要明确"运行时作用域"语义的上下文中使用。
 */
export const createRuntimeScope = createScope

/**
 * 创建一个已释放状态的 handle。
 *
 * 当 scope 已释放后调用 add() 时返回此 handle，避免调用方额外判空。
 *
 * @returns 已释放状态的 ScopeCleanupHandle
 */
const createDisposedHandle = (): ScopeCleanupHandle => {
  return {
    disposed: true,
    dispose: noop,
  }
}

/**
 * 空操作函数。
 */
const noop = (): void => {}

/**
 * 执行 cleanup 并捕获错误。
 *
 * cleanup 抛错不阻断后续清理流程，错误通过 reportRuntimeCleanupError 上报。
 *
 * @param cleanup - 要执行的 cleanup 函数
 */
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
 * Scope 会吞掉 cleanup 抛出的错误以保证后续清理继续执行；这个函数是统一的
 * 错误上报出口。
 *
 * @param error - cleanup 抛出的错误。
 */
export function reportRuntimeCleanupError(error: unknown): void {
  console.error("[schemx] Scope cleanup 执行错误", error)
}
