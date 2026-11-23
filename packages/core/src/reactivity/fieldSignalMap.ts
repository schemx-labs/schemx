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

import { createSignal } from "./signal"

import type { FieldSignal } from "./fieldSignal"

/**
 * FieldSignalMap 配置项。
 */
export interface FieldSignalMapOptions<K> {
  /**
   * 自定义字段路径标准化函数。
   *
   * @param key - 原始字段路径。
   * @returns 标准化后的映射 key。
   */
  normalizeKey?: (key: K | unknown) => string
}

interface FieldSignalRecord<K, V> {
  readonly key: K
  readonly value: FieldSignal<V>
}

/**
 * 字段状态 signal 映射。
 *
 * @typeParam K - 字段路径类型
 * @typeParam V - 字段值类型
 */
class FieldSignalMapImpl<K, V> {
  private readonly records = new Map<string, FieldSignalRecord<K, V>>()

  private readonly version = createSignal(0)

  private readonly normalizeKey: (key: K | unknown) => string

  constructor(options: FieldSignalMapOptions<K> = {}) {
    this.normalizeKey = options.normalizeKey ?? defaultNormalizeFieldKey
  }

  /**
   * 获取字段 key 的标准化字符串。
   */
  private getKey(key: K | unknown): string {
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
  public get(key: K): FieldSignal<V> | undefined {
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
  public peek(key: K): FieldSignal<V> | undefined {
    return this.records.get(this.getKey(key))?.value
  }

  /**
   * 设置字段 signal。
   *
   * @param key - 字段路径。
   * @param value - 字段 signal。
   * @returns 当前映射实例，便于链式调用。
   */
  public set(key: K, value: FieldSignal<V>): this {
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
  public has(key: K): boolean {
    return this.records.has(this.getKey(key))
  }

  /**
   * 删除字段 signal。
   *
   * @param key - 字段路径。
   * @returns 是否删除了已存在的字段 signal。
   */
  public delete(key: K): boolean {
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
  public keys(): IterableIterator<K> {
    void this.version.value

    return Array.from(this.records.values(), (record) => record.key).values()
  }

  /**
   * 响应式遍历字段 signal。
   *
   * @returns 字段 signal 的迭代器。
   */
  public values(): IterableIterator<FieldSignal<V>> {
    void this.version.value

    return Array.from(this.records.values(), (record) => record.value).values()
  }

  /**
   * 响应式遍历 `[key, signal]`。
   *
   * @returns 原始字段 key 与字段 signal 的迭代器。
   */
  public entries(): IterableIterator<[K, FieldSignal<V>]> {
    void this.version.value

    return Array.from(
      this.records.values(),
      (record) => [record.key, record.value] as [K, FieldSignal<V>]
    ).values()
  }
}

/**
 * FieldSignalMap 的实例类型。
 */
export type FieldSignalMap<K, V> = InstanceType<typeof FieldSignalMapImpl<K, V>>

/**
 * 创建 FieldSignalMap 实例。
 *
 * @param options - 字段路径标准化配置。
 * @returns 新的字段 signal 映射。
 */
export function createFieldSignalMap<K, V>(
  options: FieldSignalMapOptions<K> = {}
): FieldSignalMap<K, V> {
  return new FieldSignalMapImpl<K, V>(options)
}

function disposeSignal(signal: FieldSignal<unknown>): void {
  signal.value.value = undefined
  signal.initialValue.value = undefined
  signal.touched.value = false
  signal.pending.value = false
}

function defaultNormalizeFieldKey(key: unknown): string {
  if (Array.isArray(key)) {
    return key.map((part) => String(part)).join(".")
  }

  return String(key)
}
