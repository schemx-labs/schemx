/**
 * FieldSignalMap - 字段路径到 FieldSignal 的响应式映射。
 *
 * API 尽量贴近原生 Map：`get`、`set`、`has`、`delete`、`clear`、
 * `keys`、`values`、`entries`。额外提供 `peek` 用于无依赖追踪读取。
 *
 * 与普通 Map 的差异：
 * - key 会被标准化后存储，默认数组路径按 `.` 连接。
 * - `get/keys/values/entries` 会追踪结构版本，字段新增/删除时 effect 会重跑。
 * - `delete/clear` 会通知被删除的旧 FieldSignal 订阅者。
 *
 * @module core/reactivity/fieldSignalMap
 */

import { createFieldKey } from "../utils/path"

import { createSignal } from "./signal"

import type { FieldSignal } from "./fieldSignal"

/**
 * FieldSignalMap 配置项。
 */
export interface FieldSignalMapOptions<TKey> {
  /**
   * 自定义字段路径标准化函数。
   *
   * @param key - 原始字段路径。
   * @returns 标准化后的映射 key。
   */
  normalizeKey?: (key: TKey | unknown) => string
}

interface FieldSignalRecord<TKey, TValue> {
  readonly key: TKey
  readonly value: FieldSignal<TValue>
}

/**
 * 字段状态 signal 映射。
 *
 * @typeParam TKey - 字段路径类型
 * @typeParam TValue - 字段值类型
 */
class FieldSignalMapImpl<TKey, TValue> {
  private readonly records = new Map<string, FieldSignalRecord<TKey, TValue>>()

  private readonly version = createSignal(0)

  private readonly normalizeKey: (key: TKey | unknown) => string

  constructor(options: FieldSignalMapOptions<TKey> = {}) {
    this.normalizeKey = options.normalizeKey ?? defaultNormalizeFieldKey
  }

  /**
   * 获取字段 key 的标准化字符串。
   */
  private getKey(key: TKey | unknown): string {
    return this.normalizeKey(key)
  }

  /**
   * 获取字段 signal。
   *
   * 读取缺失 key 时会订阅结构版本；后续 set 同 key 会触发 effect 重跑。
   *
   * @param key - 字段路径。
   * @returns 字段 signal；未创建时返回 undefined。
   */
  public get(key: TKey): FieldSignal<TValue> | undefined {
    const record = this.records.get(this.getKey(key))

    if (record) {
      return record.value
    }

    void this.version.value

    return undefined
  }

  /**
   * 无依赖追踪地获取字段 signal。
   *
   * @param key - 字段路径。
   * @returns 字段 signal；未创建时返回 undefined。
   */
  public peek(key: TKey): FieldSignal<TValue> | undefined {
    return this.records.get(this.getKey(key))?.value
  }

  /**
   * 设置字段 signal。
   *
   * @param key - 字段路径。
   * @param value - 字段 signal。
   * @returns 当前映射实例，便于链式调用。
   */
  public set(key: TKey, value: FieldSignal<TValue>): this {
    const normalizedKey = this.getKey(key)

    const exists = this.records.has(normalizedKey)

    this.records.set(normalizedKey, { key, value })

    if (!exists) {
      this.version.value++
    }

    return this
  }

  /**
   * 判断字段是否存在。
   *
   * @param key - 字段路径。
   * @returns 字段 signal 是否已存在。
   */
  public has(key: TKey): boolean {
    return this.records.has(this.getKey(key))
  }

  /**
   * 删除字段 signal。
   *
   * @param key - 字段路径。
   * @returns 是否删除了已存在的字段 signal。
   */
  public delete(key: TKey): boolean {
    const normalizedKey = this.getKey(key)

    const record = this.records.get(normalizedKey)

    if (!record) return false

    this.records.delete(normalizedKey)
    disposeSignal(record.value)
    this.version.value++

    return true
  }

  /**
   * 清空所有字段 signal。
   */
  public clear(): void {
    if (this.records.size === 0) return

    for (const record of this.records.values()) {
      disposeSignal(record.value)
    }

    this.records.clear()
    this.version.value++
  }

  /**
   * 响应式遍历原始字段 key。
   *
   * @returns 原始字段 key 的迭代器。
   */
  public keys(): IterableIterator<TKey> {
    void this.version.value

    return Array.from(this.records.values(), (record) => record.key).values()
  }

  /**
   * 响应式遍历字段 signal。
   *
   * @returns 字段 signal 的迭代器。
   */
  public values(): IterableIterator<FieldSignal<TValue>> {
    void this.version.value

    return Array.from(this.records.values(), (record) => record.value).values()
  }

  /**
   * 响应式遍历 `[key, signal]`。
   *
   * @returns 原始字段 key 与字段 signal 的迭代器。
   */
  public entries(): IterableIterator<[TKey, FieldSignal<TValue>]> {
    void this.version.value

    return Array.from(
      this.records.values(),
      (record) => [record.key, record.value] as [TKey, FieldSignal<TValue>]
    ).values()
  }
}

/**
 * FieldSignalMap 的实例类型。
 */
export type FieldSignalMap<TKey, TValue> = InstanceType<
  typeof FieldSignalMapImpl<TKey, TValue>
>

/**
 * 创建 FieldSignalMap 实例。
 *
 * @param options - 字段路径标准化配置。
 * @returns 新的字段 signal 映射。
 */
export function createFieldSignalMap<TKey, TValue>(
  options: FieldSignalMapOptions<TKey> = {}
): FieldSignalMap<TKey, TValue> {
  return new FieldSignalMapImpl<TKey, TValue>(options)
}

/**
 * 释放字段 signal 的底层状态，将其各子 signal 重置为默认值。
 *
 * 在 delete/clear 时调用，确保旧 signal 的订阅者收到值变更通知。
 *
 * @param signal - 待释放的字段 signal。
 */
function disposeSignal(signal: FieldSignal<unknown>): void {
  signal.value.value = undefined
  signal.initialValue.value = undefined
  signal.touched.value = false
  signal.pending.value = false
}

/**
 * 默认字段路径标准化函数。
 *
 * 数组路径按 `.` 连接为字符串，非数组路径直接转为字符串。
 *
 * @param key - 原始字段路径。
 * @returns 标准化后的字符串 key。
 */
function defaultNormalizeFieldKey(key: unknown): string {
  return createFieldKey(key as never)
}
