/**
 * Store - 基于 FieldSignal 的表单数据存储中心
 *
 * 每个字段路径对应一个独立的 FieldSignal。字段值、初始值、
 * touched 和 pending 由同一个字段状态单元管理，支持自动依赖追踪和精确更新。
 *
 * @module core/store
 *
 * @example
 * ```typescript
 * const store = new Store({ initialValues: { name: 'John', age: 25 } })
 *
 * // 读写值
 * store.getFieldValue('name') // => 'John'
 * store.setFieldValue('name', 'Jane')
 *
 * // 批量操作
 * store.setFieldsValue({ name: 'Bob', age: 30 })
 * ```
 */

import { cloneDeep, isEqual } from "es-toolkit"

import {
  batchUpdates,
  createFieldSignal,
  createFieldSignalMap,
  createSignal,
  onBatchComplete,
} from "../reactivity"
import {
  areOverlappingFieldPaths,
  collectObjectPathsByLeaf,
  createFieldKey,
  getByPath,
  isDescendantFieldPath,
  normalizeNamePath,
  setByPath,
} from "../utils"

import type { FieldSignal } from "../reactivity"
import type { FieldValue, NamePath, Values } from "../types"
import type { Store, StoreOptions, StorePending } from "./types"

export type { Store, StoreOptions, StorePending, StoreState } from "./types"

/**
 * 基于 FieldSignal 的表单数据存储中心。
 *
 * 每个字段路径对应一个独立的字段状态 signal。所有状态变更通过 reactive
 * effect 自动感知，无需手动订阅。
 *
 * @typeParam TValues - 表单值类型，默认为 Values
 * @example
 * ```typescript
 * const store = new Store({ initialValues: { name: 'John' } })
 * store.getFieldValue('name') // => 'John'
 * ```
 */
class StoreImpl<TValues extends Values = Values> implements Store<TValues> {
  /**
   * 每个字段路径对应一个 FieldSignal。
   */
  private fieldSignals = createFieldSignalMap<NamePath<TValues>, unknown>()

  /**
   * 已由 Schema Runtime 注册的字段值边界。
   *
   * 批量写入命中该路径时，数组和对象都作为该字段的整体值保存，
   * 不再继续展开为子路径 Signal。
   */
  private readonly registeredFieldPaths = new Map<string, NamePath<TValues>>()

  /** 当前值变更的单调 revision；完整快照按此 revision 缓存。 */
  private readonly valueRevision = createSignal(0)

  /** 当前 batch 中发生值或字段结构变化的精确路径。 */
  private readonly changedPaths = new Set<NamePath<TValues>>()

  /** 已缓存完整快照对应的 revision。 */
  private snapshotRevision = -1

  /** 同一 revision 内复用的完整值快照。 */
  private snapshotCache: TValues | undefined

  /** 释放 batch 完成监听，避免 Store 销毁后保留引用。 */
  private readonly disposeBatchListener: () => void

  /**
   * 与当前值隔离存储的初始字段值。
   */
  private initialValues: Partial<TValues>

  /**
   * 创建 Store 实例。
   *
   * 对 initialValues 进行深拷贝，确保内部状态与外部引用隔离。
   * 为每个初始字段路径创建对应的 reactive value。
   *
   * @param options - 配置选项
   */
  constructor(options: StoreOptions<TValues> = {}) {
    const initialValues = (options.initialValues ?? {}) as Partial<TValues>

    this.initialValues = cloneDeep(initialValues)

    // 为初始值的每个叶子路径创建 reactive value
    const paths = collectObjectPathsByLeaf<TValues, NamePath<TValues>>(initialValues)

    for (const path of paths) {
      const value = getByPath<TValues, typeof path>(initialValues, path)

      this.fieldSignals.set(
        path,
        createFieldSignal<typeof value>({
          value: value,
          initialValue: value,
        })
      )
    }

    this.disposeBatchListener = onBatchComplete(() => {
      this.commitValueChanges()
    })
  }

  /**
   * 记录值或字段结构变化，延后到最外层 batch 一次性提交 revision。
   */
  private markValueChanged(path: NamePath<TValues>): void {
    this.changedPaths.add(path)
  }

  /**
   * 提交当前 batch 的字段变更并使完整快照缓存失效。
   */
  private commitValueChanges(): void {
    if (this.changedPaths.size === 0) return

    this.changedPaths.clear()
    this.snapshotRevision = -1
    this.valueRevision.value += 1
  }

  /**
   * 返回当前 revision 的完整值快照；同一 revision 最多构建一次。
   */
  private getFullSnapshot(): TValues {
    const revision = this.valueRevision.peek()

    if (this.snapshotRevision === revision && this.snapshotCache) {
      return this.snapshotCache
    }

    const result = {} as TValues

    for (const path of this.fieldSignals.keys()) {
      setByPath(result, path, this.getFieldSnapshot(path))
    }

    this.snapshotRevision = revision
    this.snapshotCache = result

    return result
  }

  /**
   * 注册 Schema 字段路径，作为批量写入的原子值边界。
   *
   * Runtime 在字段挂载时调用。若 Store 已因初始值或提前批量写入创建了
   * 该字段的后代 Signal，则将它们归并为当前字段的整体 Signal。
   */
  registerFieldPath<TName extends NamePath<TValues>>(path: TName): void {
    const key = createFieldKey(path)

    if (this.registeredFieldPaths.has(key)) {
      return
    }

    for (const registeredPath of this.registeredFieldPaths.values()) {
      if (areOverlappingFieldPaths(path, registeredPath)) {
        throw new Error(
          `[schemx] Field paths "${normalizeNamePath(path)}" and ` +
            `"${normalizeNamePath(registeredPath)}" overlap. ` +
            "A value subtree can only be owned by one schema field."
        )
      }
    }

    const currentValues = this.getFieldsSnapshot()

    const currentValue = getByPath<TValues, TName>(currentValues, path)

    const initialValue = getByPath<TValues, TName>(this.initialValues, path)

    const descendantPaths = [...this.fieldSignals.keys()].filter((candidate) =>
      isDescendantFieldPath(candidate, path)
    )

    const existingSignal = this.fieldSignals.peek(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    this.registeredFieldPaths.set(key, path)

    if (existingSignal && descendantPaths.length === 0) {
      return
    }

    batchUpdates(() => {
      for (const descendantPath of descendantPaths) {
        this.fieldSignals.delete(descendantPath)
      }

      if (existingSignal) {
        if (!isEqual(existingSignal.value.peek(), currentValue)) {
          existingSignal.setValue(currentValue)
        }

        existingSignal.setInitialValue(initialValue)
      } else if (currentValue !== undefined || initialValue !== undefined) {
        this.fieldSignals.set(
          path,
          createFieldSignal<FieldValue<TValues, TName>>({
            value: currentValue,
            initialValue,
          })
        )
      }

      if (descendantPaths.length > 0 || existingSignal === undefined) {
        this.markValueChanged(path)
      }
    })
  }

  /**
   * 批量注册 Schema 字段路径。
   *
   * 每个路径仍通过 `registerFieldPath` 执行，以保持重复路径和重叠路径的校验语义一致。
   *
   * @param paths - 要注册的字段路径数组。
   */
  registerFieldPaths<TName extends NamePath<TValues>>(paths: TName[]): void {
    batchUpdates(() => {
      for (const path of paths) {
        this.registerFieldPath(path)
      }
    })
  }

  /**
   * 按已注册字段边界将一个嵌套值对象拆为写入条目。
   */
  private collectValueEntries(
    values: Partial<TValues>
  ): Array<[NamePath<TValues>, unknown]> {
    const entries: Array<[NamePath<TValues>, unknown]> = []

    const visit = (value: unknown, path: string): void => {
      const name = path as NamePath<TValues>

      if (this.registeredFieldPaths.has(createFieldKey(name))) {
        entries.push([name, value])

        return
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          visit(item, `${path}[${index}]`)
        })

        return
      }

      if (value !== null && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          visit(child, path ? `${path}.${key}` : key)
        }

        return
      }

      entries.push([name, value])
    }

    for (const [key, value] of Object.entries(values)) {
      visit(value, key)
    }

    return entries
  }

  /**
   * 获取或惰性创建指定路径的字段 signal。
   *
   * 若该路径尚未注册对应 signal，则根据 initialValues 中的值创建新的
   * FieldSignal。此方法确保字段读写时 signal 始终可用，避免空值判断。
   *
   * @param path - 字段路径
   * @returns 该路径对应的 FieldSignal 实例
   */
  private getOrCreateFieldSignal<TName extends NamePath<TValues>>(
    path: TName
  ): FieldSignal<FieldValue<TValues, TName>> {
    const initialValue = getByPath<TValues, TName>(this.initialValues, path)

    let signal = this.fieldSignals.peek(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    if (!signal) {
      signal = createFieldSignal<FieldValue<TValues, TName>>({
        value: initialValue,
        initialValue: initialValue,
      })
      this.fieldSignals.set(path, signal)
    }

    return signal
  }

  /**
   * 获取指定路径的字段值。
   *
   * 读取对应 reactive value，在 effect 中使用时自动收集依赖。
   *
   * @param path - 字段路径，支持嵌套路径如 'user.name'
   * @returns 字段当前值
   *
   * @example
   * ```typescript
   * store.getFieldValue('name')         // => 'John'
   * store.getFieldValue('user.address') // => { city: 'Beijing', zip: '100000' }
   * ```
   */
  getFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    const signal = this.fieldSignals.get(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    return signal?.value.value
  }

  /**
   * 设置指定路径的字段值。
   *
   * 直接写入对应 reactive value，自动触发依赖它的 effect。
   *
   * @param path - 字段路径
   * @param value - 要设置的值
   *
   * @example
   * ```typescript
   * store.setFieldValue('name', 'Jane')
   * store.setFieldValue('user.age', 30)
   * ```
   */
  setFieldValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void {
    batchUpdates(() => {
      const existingSignal = this.fieldSignals.peek(path)

      const signal = this.getOrCreateFieldSignal(path)

      if (!existingSignal || !isEqual(signal.value.peek(), value)) {
        signal.setValue(value)
        this.markValueChanged(path)
      }
    })
  }

  /**
   * 获取多个字段的值。
   *
   * 不传参返回全量值，传入路径数组返回指定字段的值。
   * 读取 reactive value 时会收集依赖。
   *
   * @param paths - 可选，要获取的字段路径数组
   * @returns 全量值或指定字段的值
   *
   * @example
   * ```typescript
   * store.getFieldsValue()                  // => { name: 'John', age: 25 }
   * store.getFieldsValue(['name', 'age'])   // => { name: 'John', age: 25 }
   * ```
   */
  getFieldsValue(): TValues
  /** 按指定字段路径返回部分表单值。 */
  getFieldsValue<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /** 按可选路径构造当前表单值结果。 */
  getFieldsValue<TName extends NamePath<TValues>>(paths?: TName[]): Partial<TValues> {
    const result = {} as Partial<TValues>

    const pathsArr = paths ?? this.fieldSignals.keys()

    for (const path of pathsArr) {
      setByPath(result, path, this.getFieldValue(path))
    }

    return result
  }

  /**
   * 批量设置多个字段的值。
   *
   * 批量设置多个字段；每个字段写入都会更新对应 FieldSignal。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * store.setFieldsValue({ name: 'Bob', age: 30 })
   * ```
   */
  setFieldsValue(values: Partial<TValues>): void {
    const entries = this.collectValueEntries(values)

    batchUpdates(() => {
      for (const [path, value] of entries) {
        this.setFieldValue(path, value as FieldValue<TValues, typeof path>)
      }
    })
  }

  /**
   * 获取单个字段值的快照。
   *
   * 使用 signal.peek() 避免收集依赖；字段值本身不会被额外深拷贝。
   *
   * @param path - 字段路径
   *
   * @returns 该字段当前值
   *
   * @example
   * ```typescript
   * const name = store.getFieldSnapshot('name') // => 'John'
   * ```
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    const signal = this.fieldSignals.peek(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    return signal?.value.peek()
  }

  /**
   * 获取当前表单值的快照。
   *
   * 使用 signal.peek() 避免收集依赖，返回新建的顶层值对象；字段值本身不会被额外深拷贝。
   * 传入 paths 时只返回指定字段的快照。
   *
   * @param paths - 可选的字段路径数组，不传则返回全部字段
   *
   * @returns 当前表单值组成的新对象
   *
   * @example
   * ```typescript
   * const snapshot = store.getFieldsSnapshot()
   * const partial = store.getFieldsSnapshot(['name', 'age'])
   * ```
   */
  getFieldsSnapshot(): TValues
  /** 按指定字段路径返回部分表单快照。 */
  getFieldsSnapshot<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /** 按可选路径构造当前表单快照。 */
  getFieldsSnapshot<TName extends NamePath<TValues>>(
    paths?: TName[]
  ): TValues | Partial<TValues> {
    if (paths === undefined) {
      return this.getFullSnapshot()
    }

    const result = {} as Partial<TValues>

    for (const path of paths) {
      setByPath(result, path, this.getFieldSnapshot(path))
    }

    return result
  }

  /**
   * 获取指定字段的初始值。
   *
   * @param path - 字段路径
   * @returns 字段初始值，不存在时返回 undefined
   *
   * @example
   * ```typescript
   * store.getInitialValue('name') // => 'John'
   * ```
   */
  getInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    const signal = this.fieldSignals.peek(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    if (signal) {
      return signal.initialValue.peek()
    }

    return getByPath<TValues, TName>(this.initialValues, path)
  }

  /**
   * 获取表单初始值。
   *
   * 不传参返回全量初始值的深拷贝，传入路径数组返回指定字段的初始值。
   *
   * @param paths - 可选，字段路径数组
   * @returns 全量初始值或指定字段的初始值
   *
   * @example
   * ```typescript
   * store.getInitialValues()         // => { name: 'John', age: 25 }
   * store.getInitialValues(['name']) // => { name: 'John' }
   * ```
   */
  getInitialValues(): Partial<TValues>
  /** 按指定字段路径返回部分初始值。 */
  getInitialValues<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /** 按可选路径返回初始值快照。 */
  getInitialValues<TName extends NamePath<TValues>>(paths?: TName[]): Partial<TValues> {
    if (paths === undefined) {
      return cloneDeep(this.initialValues)
    }

    const result = {} as Partial<TValues>

    for (const path of paths) {
      setByPath(result, path, getByPath<TValues, TName>(this.initialValues, path))
    }

    return result
  }

  /**
   * 设置指定字段的初始值。
   *
   * @param path - 字段路径
   * @param value - 要设置的初始值
   *
   * @example
   * ```typescript
   * store.setInitialValue('name', 'Bob')
   * ```
   */
  setInitialValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName>
  ): void {
    setByPath(this.initialValues, path, value)
    const signal = this.getOrCreateFieldSignal(path)

    signal.setInitialValue(value)
  }

  /**
   * 批量设置多个字段的初始值。
   *
   * @param values - 要设置的字段值对象
   *
   * @example
   * ```typescript
   * store.setInitialValues({ name: 'Bob', age: 30 })
   * ```
   */
  setInitialValues(values: Partial<TValues>): void {
    const entries = this.collectValueEntries(values)

    if (!entries.length) return

    batchUpdates(() => {
      for (const [path, value] of entries) {
        const next = value as FieldValue<TValues, typeof path>

        setByPath(this.initialValues, path, next)

        const signal = this.getOrCreateFieldSignal(path)

        signal.setInitialValue(next)
      }
    })
  }

  /**
   * 检查指定字段是否发生过显式交互。
   *
   * @param path - 字段路径
   * @returns 是否与初始值不同
   *
   * @example
   * ```typescript
   * store.setFieldTouched('name', true)
   * store.isFieldTouched('name') // => true
   * ```
   */
  isFieldTouched<TName extends NamePath<TValues>>(path: TName): boolean {
    return this.fieldSignals.get(path)?.touched.value ?? false
  }

  /**
   * 检查多个字段是否被修改。
   *
   * 传入路径数组时检查所有指定字段是否都被修改，不传则检查是否有任一字段被修改。
   *
   * @param paths - 可选，要检查的字段路径数组
   * @returns 是否被修改
   *
   * @example
   * ```typescript
   * store.isFieldsTouched(['name', 'age']) // => true（全部被修改时）
   * store.isFieldsTouched()               // => true（任一字段被修改时）
   * ```
   */
  isFieldsTouched(): boolean
  /** 检查指定字段是否全部被修改。 */
  isFieldsTouched<TName extends NamePath<TValues>>(paths: TName[]): boolean
  /** 按是否传入路径选择任一或全部字段的 touched 判断。 */
  isFieldsTouched<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    const pathsArr = paths ?? [...this.fieldSignals.keys()]

    return paths === undefined
      ? pathsArr.some((path) => this.isFieldTouched(path))
      : pathsArr.every((path) => this.isFieldTouched(path))
  }

  /**
   * 获取所有发生过显式交互的字段路径。
   *
   * @returns 被修改的字段路径数组
   *
   * @example
   * ```typescript
   * store.getTouchedFields() // => ['name', 'user.age']
   * ```
   */
  getTouchedFields(): NamePath<TValues>[] {
    const touchedFields: NamePath<TValues>[] = []

    for (const [path, signal] of this.fieldSignals.entries()) {
      if (signal.touched.value) {
        touchedFields.push(path)
      }
    }

    return touchedFields
  }

  /**
   * 设置字段的交互状态。
   *
   * @param path - 字段路径
   * @param touched - 是否被修改
   *
   * @example
   * ```typescript
   * store.setFieldTouched('name', true)
   * ```
   */
  setFieldTouched<TName extends NamePath<TValues>>(path: TName, touched: boolean): void {
    this.getOrCreateFieldSignal(path).setTouched(touched)
  }

  /**
   * 批量设置字段的修改状态。
   *
   * @param paths - 要设置 touched 状态的字段路径数组
   * @param touched - 目标 touched 状态，默认 true
   *
   * @example
   * ```typescript
   * store.setFieldsTouched(['name', 'age'], true)
   * ```
   */
  setFieldsTouched<TName extends NamePath<TValues>>(
    paths: TName[],
    touched = true
  ): void {
    batchUpdates(() => {
      for (const path of paths) {
        this.setFieldTouched(path, touched)
      }
    })
  }

  /**
   * 检查单个字段是否处于操作中。
   *
   * 读取对应 reactive value，在 effect 中使用时自动收集依赖。
   *
   * @param path - 字段路径
   * @returns 是否处于操作中
   *
   * @example
   * ```typescript
   * store.isFieldPending('avatar') // => true
   * ```
   */
  isFieldPending<TName extends NamePath<TValues>>(path: TName): boolean {
    return this.fieldSignals.get(path)?.pending.value ?? false
  }

  /**
   * 检查多个字段是否处于操作中。
   *
   * 传入路径数组时检查所有指定字段是否都处于操作中，不传则检查是否有任一字段处于操作中。
   *
   * @param paths - 可选，要检查的字段路径数组
   * @returns 是否处于操作中
   *
   * @example
   * ```typescript
   * store.isFieldsPending(['name', 'age']) // => true（全部处于操作中时）
   * store.isFieldsPending()               // => true（任一字段处于操作中时）
   * ```
   */
  isFieldsPending(): boolean
  /** 检查指定字段是否全部处于 pending 状态。 */
  isFieldsPending<TName extends NamePath<TValues>>(paths: TName[]): boolean
  /** 按是否传入路径选择任一或全部字段的 pending 判断。 */
  isFieldsPending<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    if (paths) {
      return paths.every((path) => this.isFieldPending(path))
    }

    return [...this.fieldSignals.keys()].some((path) => this.isFieldPending(path))
  }

  /**
   * 获取所有处于操作中的字段路径。
   *
   * 遍历字段 signal，收集 pending 为 true 的字段路径。
   * 无操作中字段时返回空数组。
   *
   * @returns 操作中的字段路径数组
   *
   * @example
   * ```typescript
   * store.getPendingFields() // => ['avatar', 'attachment']
   * ```
   */
  getPendingFields(): StorePending<TValues, NamePath<TValues>>[] {
    const fields: StorePending<TValues, NamePath<TValues>>[] = []

    for (const [field, signal] of this.fieldSignals.entries()) {
      if (signal.pending.value) {
        fields.push({ field, message: signal.pendingMessage.value })
      }
    }

    return fields
  }

  /**
   * 设置字段的操作中状态。
   *
   * 标记字段正在进行异步操作（如文件上传），
   * 校验和提交时会检查是否有字段处于操作中状态。
   * 取消操作中状态时删除对应 key，保持 map 干净。
   *
   * @param path - 字段路径
   * @param pending - 是否处于操作中
   * @param message - 可选的操作中提示信息。
   *
   * @example
   * ```typescript
   * store.setFieldPending('avatar', true)   // 上传开始
   * store.setFieldPending('avatar', false)  // 上传结束
   * ```
   */
  setFieldPending<TName extends NamePath<TValues>>(
    path: TName,
    pending: boolean,
    message?: string | string[]
  ): void {
    this.getOrCreateFieldSignal(path).setPending(pending, message)
  }

  /**
   * 批量设置字段的操作中状态。
   *
   * @param paths - 要设置 pending 状态的字段路径数组
   * @param pending - 目标 pending 状态，默认 true
   * @param message - 可选的操作中提示信息。
   *
   * @example
   * ```typescript
   * store.setFieldsPending(['name', 'age'], true)
   * ```
   */
  setFieldsPending<TName extends NamePath<TValues>>(
    paths: TName[],
    pending = true,
    message?: string | string[]
  ): void {
    batchUpdates(() => {
      for (const path of paths) {
        this.setFieldPending(path, pending, message)
      }
    })
  }

  /**
   * 重置单个字段到初始值。
   *
   * @param path - 要重置的字段路径。
   *
   * @example
   * ```typescript
   * store.resetField('name')
   * ```
   */
  resetField<TName extends NamePath<TValues>>(path: TName): void {
    batchUpdates(() => {
      const signal = this.getOrCreateFieldSignal(path)

      const initialValue = signal.initialValue.peek()

      if (!isEqual(signal.value.peek(), initialValue)) {
        this.markValueChanged(path)
      }

      signal.reset()
    })
  }

  /**
   * 批量重置指定字段到初始值。
   *
   * @param paths - 要重置的字段路径数组。
   *
   * @example
   * ```typescript
   * store.resetFields(['name', 'age'])
   * ```
   */
  resetFields<TName extends NamePath<TValues>>(paths: TName[]): void {
    batchUpdates(() => {
      for (const path of paths) {
        const signal = this.getOrCreateFieldSignal(path)

        const initialValue = signal.initialValue.peek()

        if (!isEqual(signal.value.peek(), initialValue)) {
          this.markValueChanged(path)
        }

        signal.reset()
      }
    })
  }

  /**
   * 重置表单到初始状态（diff 式更新）。
   *
   * 不传参时恢复到构造时的初始值，传入 values 时同时更新初始值。
   * 对比新旧路径集合：复用已有字段 signal、删除多余字段 signal、
   * 创建新字段 signal。
   *
   * @param values - 可选的新初始值；传入后会同时更新 initialValues baseline。
   *
   * @example
   * ```typescript
   * store.reset()                              // 恢复到构造时的初始值
   * store.reset({ name: 'New', age: 0 })       // 重置并更新初始值
   * ```
   */
  reset(values?: Partial<TValues>): void {
    const resetValues = cloneDeep(values ?? this.initialValues)

    if (values !== undefined) {
      this.initialValues = cloneDeep(resetValues)
    }

    const nextEntries = this.collectValueEntries(resetValues)

    const nextPaths = nextEntries.map(([path]) => path)

    const nextPathSet = new Set(nextPaths)

    batchUpdates(() => {
      for (const path of this.fieldSignals.keys()) {
        if (!nextPathSet.has(path)) {
          this.fieldSignals.delete(path)
          this.markValueChanged(path)
        }
      }

      for (const [path, value] of nextEntries) {
        const next = value as FieldValue<TValues, typeof path>

        const signal = this.fieldSignals.peek(path)

        if (signal) {
          if (!isEqual(signal.value.peek(), next)) {
            this.markValueChanged(path)
          }

          signal.setInitialValue(next)
          signal.reset(next)
        } else {
          this.fieldSignals.set(
            path,
            createFieldSignal<typeof next>({
              value: next,
              initialValue: next,
            })
          )
          this.markValueChanged(path)
        }
      }
    })
  }

  /**
   * 销毁 Store 实例。
   *
   * 清理所有字段 signal，释放资源。
   *
   * @example
   * ```typescript
   * store.destroy()
   * ```
   */
  destroy(): void {
    this.fieldSignals.clear()
    this.registeredFieldPaths.clear()
    this.changedPaths.clear()
    this.snapshotCache = undefined
    this.disposeBatchListener()
  }
}

/**
 * 创建 Store 实例的工厂函数。
 *
 * @typeParam T - 表单值类型
 *
 * @param options - 配置选项
 * @returns Store 实例
 *
 * @example
 * ```typescript
 * const store = createStore({ initialValues: { name: 'John' } })
 * ```
 */
export function createStore<TValues extends Values = Values>(
  options: StoreOptions<TValues> = {}
): Store<TValues> {
  return new StoreImpl<TValues>(options)
}
