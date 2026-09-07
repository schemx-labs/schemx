/**
 * Form 状态适配器内部的可管理快照来源实现。
 *
 * @module core/adapter/formStateAdapter/snapshotSource
 */

import type { SnapshotSource } from "./types"
import type { SchemxInstance, Values } from "../../types"

/**
 * 内部使用的、可主动停止的快照来源。
 *
 * 该类型只在 FormStateAdapter 实现内部使用，不作为适配器公开协议暴露。
 *
 * @typeParam TSnapshot - 快照来源提供的快照类型。
 */
export interface ManagedSnapshotSource<TSnapshot> extends SnapshotSource<TSnapshot> {
  /**
   * 释放监听器和 Core effect。
   */
  dispose(): void
}

/**
 * 创建由 Form effect 驱动的稳定快照来源。
 *
 * Core effect 会在首次订阅时惰性启动，并在最后一个订阅取消或来源释放时停止。
 * 无订阅者时，`getSnapshot()` 仍会同步刷新一次快照，但不会创建持久的 Core effect。
 *
 * @typeParam TValues - Form 的值类型。
 * @typeParam TSnapshot - 快照来源提供的快照类型。
 * @param options - 快照读取、比较和依赖追踪配置。
 * @param options.form - 提供 effect 生命周期的 Core Form。
 * @param options.track - 可选的额外读取函数，用于在 effect 中建立值依赖。
 * @param options.readSnapshot - 读取当前快照的函数。
 * @param options.isSnapshotEqual - 判断前后快照是否等价的比较函数。
 * @returns 可订阅、可读取并可主动释放的内部快照来源。
 *
 * @example
 * ```ts
 * const source = createManagedSnapshotSource({
 *   form,
 *   readSnapshot: () => form.getFieldsSnapshot(),
 *   isSnapshotEqual: Object.is,
 * })
 * ```
 */
export function createManagedSnapshotSource<TValues extends Values, TSnapshot>(options: {
  form: SchemxInstance<TValues>
  track?: () => void
  readSnapshot: () => TSnapshot
  isSnapshotEqual: (previous: TSnapshot, next: TSnapshot) => boolean
}): ManagedSnapshotSource<TSnapshot> {
  const { form, track, readSnapshot, isSnapshotEqual } = options

  // Set 同时保证监听器不重复注册，并支持在通知期间安全增删监听器。
  const listeners = new Set<() => void>()

  // 缓存最近一次快照，保证无变化时返回同一引用。
  let snapshot = readSnapshot()

  // 一个来源最多持有一个 Core effect，由首个订阅者按需启动。
  let disposeEffect: (() => void) | undefined

  // 释放后拒绝新订阅，并使已有来源停止工作。
  let disposed = false

  // 读取新快照，并只在内容真实变化时替换缓存。
  const refreshSnapshot = (): boolean => {
    const nextSnapshot = readSnapshot()

    if (isSnapshotEqual(snapshot, nextSnapshot)) {
      return false
    }

    snapshot = nextSnapshot

    return true
  }

  // 复制监听器集合后再通知，避免监听器在回调中修改集合影响当前遍历。
  const notifyListeners = (): void => {
    for (const listener of [...listeners]) {
      listener()
    }
  }

  // 仅在存在订阅者时启动 Core effect。
  const startEffect = (): void => {
    if (disposeEffect || disposed) {
      return
    }

    // 首次 effect 执行只用于建立依赖和同步初始快照，不向订阅者重复通知。
    let isInitialRun = true

    disposeEffect = form.effect(() => {
      track?.()
      const changed = refreshSnapshot()

      if (isInitialRun) {
        isInitialRun = false

        return
      }

      if (changed) {
        notifyListeners()
      }
    })
  }

  // 停止当前 effect，并允许后续新订阅重新建立 effect。
  const stopEffect = (): void => {
    if (!disposeEffect) {
      return
    }

    disposeEffect()
    disposeEffect = undefined
  }

  // 无订阅者时主动刷新，确保轮询式读取仍能得到最新快照。
  const getSnapshot = (): TSnapshot => {
    if (listeners.size === 0 && !disposed) {
      refreshSnapshot()
    }

    return snapshot
  }

  /**
   * 注册监听器，并按需启动 Core effect。
   *
   * @param listener - 快照发生真实变化时调用的监听函数。
   * @returns 可重复调用的取消订阅函数。
   */
  const subscribe = (listener: () => void): (() => void) => {
    if (disposed) {
      return () => {}
    }

    listeners.add(listener)
    startEffect()

    let unsubscribed = false

    return () => {
      if (unsubscribed) {
        return
      }

      unsubscribed = true
      listeners.delete(listener)

      if (listeners.size === 0) {
        stopEffect()
      }
    }
  }

  /**
   * 释放监听器和 Core effect。
   *
   * 释放后的来源不会再次启动 effect，且后续订阅会得到空操作取消函数。
   */
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    listeners.clear()
    stopEffect()
  }

  return {
    getSnapshot,
    subscribe,
    dispose,
  }
}
