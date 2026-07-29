/**
 * SignalMap - 按 key 管理的响应式值存储。
 *
 * API 贴近原生 Map：`get`、`set`、`has`、`delete`、`clear`、
 * `keys`、`values`、`entries`。额外提供 `peek` 用于无依赖追踪读取。
 *
 * 与普通 Map 的差异：
 * - 每个 key 独占一个 signal，value 更新可以被细粒度追踪。
 * - 读取缺失 key 时会订阅结构版本；后续 set 同 key 会触发 effect 重跑。
 * - 删除/清空 key 时会通知旧 value 的订阅者。
 *
 * @module core/reactivity/signalMap
 */

import { batchUpdates } from "./batch"
import { createSignal } from "./signal"

import type { Signal } from "./signal"

/**
 * 按 key 细粒度追踪更新的响应式 Map 内部实现。
 *
 * 通过每个 key 独立 signal 实现字段级更新隔离，另含一个结构版本 signal
 * 用于追踪 key 的新增/删除。内部类不直接暴露，通过 `SignalMap` 类型
 * 和 `createSignalMap` 工厂提供公共 API。
 *
 * @typeParam TKey - key 类型
 * @typeParam TValue - value 类型
 */
class SignalMapImpl<TKey, TValue> {
  /**
   * 每个 key 独占一个 signal，保证字段级更新能细粒度触发。
   */
  private signals = new Map<TKey, Signal<TValue>>()

  /**
   * 结构版本 signal，用于追踪“新 key 创建”事件。
   *
   * effect 读取缺失 key 时会依赖这个版本；之后创建该 key 会推进版本，
   * 让 effect 重新执行并订阅新 key 对应的 signal。
   */
  private version: Signal<number> = createSignal(0)

  /**
   * 读取 key，并在 effect 内自动收集响应式依赖。
   *
   * @param key - 待读取的 key。
   * @returns key 对应的值；不存在时返回 undefined。
   */
  get(key: TKey): TValue | undefined {
    const s = this.signals.get(key)

    if (s) return s.value

    void this.version.value

    return undefined
  }

  /**
   * 写入 key；如果 key 不存在，则创建新的 signal。
   *
   * @param key - 待写入的 key。
   * @param value - 新值。
   * @returns 当前 SignalMap 实例，便于链式调用。
   */
  set(key: TKey, value: TValue): this {
    const s = this.signals.get(key)

    if (s) {
      s.value = value
    } else {
      this.signals.set(key, createSignal(value))
      this.version.value++
    }

    return this
  }

  /**
   * 无依赖追踪地读取 key。
   *
   * @param key - 待读取的 key。
   * @returns key 对应的值；不存在时返回 undefined。
   */
  peek(key: TKey): TValue | undefined {
    return this.signals.get(key)?.peek()
  }

  /**
   * 判断 key 是否存在。
   *
   * @param key - 待检查的 key。
   * @returns key 已存在时返回 true。
   */
  has(key: TKey): boolean {
    return this.signals.has(key)
  }

  /**
   * 删除 key，并通知订阅旧 signal 或 map 结构的 effects。
   *
   * @param key - 待删除的 key。
   * @returns 成功删除时返回 true；key 不存在时返回 false。
   */
  delete(key: TKey): boolean {
    const s = this.signals.get(key)

    if (!s) return false

    this.signals.delete(key)

    batchUpdates(() => {
      s.value = undefined as unknown as TValue
      this.version.value++
    })

    return true
  }

  /**
   * 清空所有 key，并通知订阅任意被删除 signal 的 effects。
   */
  clear(): void {
    if (this.signals.size === 0) return

    const oldSignals = [...this.signals.values()]

    this.signals.clear()

    batchUpdates(() => {
      for (const s of oldSignals) {
        s.value = undefined as unknown as TValue
      }

      this.version.value++
    })
  }

  /**
   * 遍历所有已注册 key。
   *
   * @returns key 迭代器。
   */
  keys(): IterableIterator<TKey> {
    void this.version.value

    return this.signals.keys()
  }

  /**
   * 遍历所有值。
   *
   * @returns value 迭代器。
   */
  values(): IterableIterator<TValue> {
    void this.version.value

    return Array.from(this.signals.values(), (signal) => signal.value).values()
  }

  /**
   * 遍历 key/value 对。
   *
   * @returns key/value entry 迭代器。
   */
  entries(): IterableIterator<[TKey, TValue]> {
    void this.version.value

    return Array.from(
      this.signals.entries(),
      ([key, signal]) => [key, signal.value] as [TKey, TValue]
    ).values()
  }
}

/**
 * SignalMap 的实例类型。
 */
export type SignalMap<TKey, TValue> = InstanceType<typeof SignalMapImpl<TKey, TValue>>

/**
 * 创建 SignalMap 实例。
 *
 * @returns 新的响应式 Map。
 */
export function createSignalMap<TKey, TValue>(): SignalMap<TKey, TValue> {
  return new SignalMapImpl<TKey, TValue>()
}
