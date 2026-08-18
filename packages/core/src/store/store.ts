/**
 * 组合 owner、字段状态、数组状态和快照模块，提供完整 Store 能力。
 */
import { cloneDeep } from "es-toolkit"

import { batchUpdates } from "../reactivity"
import { createFieldKey, getByPath } from "../utils"

import { createFieldArrayStore, type FieldArrayStore } from "./fieldArrayStore"
import { createFieldStateStore, type FieldStateStore } from "./fieldStateStore"
import { createOwnedSubtreeRegistry, type OwnedSubtreeRegistry } from "./ownedSubtree"
import { createStoreSnapshot, type StoreSnapshot } from "./storeSnapshot"

import type { FieldArrayHandle, FieldArrayItemValue, FieldArrayPath } from "../fieldArray"
import type { FieldValue, NamePath, Values } from "../types"
import type { Store, StoreOptions, StorePending } from "./types"

/**
 * Store 的唯一组合根；实现类仅在模块内部使用。
 */
class StoreImpl<TValues extends Values = Values> implements Store<TValues> {
  /**
   * 管理普通字段与数组根的 owner 归属。
   */
  private readonly registry: OwnedSubtreeRegistry<TValues>
  /**
   * 管理完整值快照 revision 和缓存。
   */
  private readonly snapshot: StoreSnapshot<TValues>
  /**
   * 管理字段值、初始值及 touched/pending 状态。
   */
  private readonly fieldState: FieldStateStore<TValues>
  /**
   * 管理数组结构 key、数组根 replace 和结构监听。
   */
  private readonly fieldArray: FieldArrayStore<TValues>
  /**
   * 将值变更通知快照管理器的回调。
   */
  private readonly markValueChanged: (path: NamePath<TValues>) => void
  /**
   * 在当前 revision 内读取完整值快照的回调。
   */
  private readonly readFullSnapshot: () => TValues

  /**
   * 创建 Store 子模块并建立它们之间的窄依赖关系。
   *
   * @param options Store 初始值配置。
   */
  constructor(options: StoreOptions<TValues> = {}) {
    this.registry = createOwnedSubtreeRegistry<TValues>()
    this.snapshot = createStoreSnapshot<TValues>()
    this.markValueChanged = (path) => {
      this.snapshot.markValueChanged(path)
    }

    this.fieldState = createFieldStateStore<TValues>({
      initialValues: options.initialValues,
      registry: this.registry,
      markValueChanged: this.markValueChanged,
    })
    this.readFullSnapshot = () =>
      this.snapshot.read(() => this.fieldState.buildFullSnapshot())
    this.fieldArray = createFieldArrayStore<TValues>({
      registry: this.registry,
      fieldState: this.fieldState,
      readSnapshot: this.readFullSnapshot,
      markValueChanged: this.markValueChanged,
    })
  }

  /**
   * 注册一个字段 owner；数组后代字段只实体化对应 Signal。
   *
   * @param path 要注册的字段路径。
   * @throws 当路径与已有不兼容 owner 重叠时抛出错误。
   */
  registerFieldPath<TName extends NamePath<TValues>>(path: TName): void {
    const plan = this.registry.prepareFieldRegistration(path)

    if (plan.action === "noop") return

    if (plan.action === "materializeDescendant") {
      this.fieldState.materializeOwnedSignal(path, plan.resolved)

      return
    }

    batchUpdates(() => {
      const currentValue = getByPath<TValues, TName>(this.readFullSnapshot(), path)

      const initialValue = this.fieldState.getInitialValue(path)

      this.registry.commitFieldRegistration(plan)
      this.fieldState.adoptOwnerRoot(path, currentValue, initialValue)
      this.markValueChanged(path)
    })
  }

  /**
   * 在同一批处理中注册多个字段 owner。
   *
   * @param paths 要注册的字段路径列表。
   */
  registerFieldPaths<TName extends NamePath<TValues>>(paths: TName[]): void {
    batchUpdates(() => {
      for (const path of paths) {
        this.registerFieldPath(path)
      }
    })
  }

  /**
   * 读取指定字段的当前值。
   *
   * @param path 要读取的字段路径。
   * @returns 当前字段值或 `undefined`。
   */
  getFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return this.fieldState.getFieldValue(path)
  }

  /**
   * 设置字段当前值，并在数组根路径上统一转发为 replace。
   *
   * @param path 要写入的字段路径。
   * @param value 要写入的字段值。
   */
  setFieldValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void {
    batchUpdates(() => {
      const resolved = this.registry.resolve(path)

      if (resolved?.owner.kind === "fieldArray" && resolved.isRoot) {
        this.fieldArray.replaceRoot(path, value, { mode: "set" })

        return
      }

      this.fieldState.setFieldValue(path, value)
    })
  }

  /**
   * 返回所有字段的当前值。
   */
  getFieldsValue(): TValues
  /**
   * 返回指定字段的当前值。
   *
   * @param paths 要读取的字段路径列表。
   */
  getFieldsValue<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /**
   * 根据是否提供路径列表读取完整或局部当前值。
   */
  getFieldsValue<TName extends NamePath<TValues>>(
    paths?: TName[]
  ): TValues | Partial<TValues> {
    return paths === undefined
      ? this.fieldState.getFieldsValue()
      : this.fieldState.getFieldsValue(paths)
  }

  /**
   * 按 owner 边界批量设置字段当前值。
   *
   * @param values 要写入的完整或部分字段值。
   */
  setFieldsValue(values: Partial<TValues>): void {
    const entries = this.fieldState.collectValueEntries(values)

    batchUpdates(() => {
      for (const [path, value] of entries) {
        this.setFieldValue(path, value as FieldValue<TValues, typeof path>)
      }
    })
  }

  /**
   * 读取指定字段的无依赖当前值。
   *
   * @param path 要读取的字段路径。
   * @returns 当前字段值或 `undefined`。
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return this.fieldState.getFieldSnapshot(path)
  }

  /**
   * 返回所有字段的无依赖当前值快照。
   */
  getFieldsSnapshot(): TValues
  /**
   * 返回指定字段的无依赖当前值快照。
   *
   * @param paths 要读取的字段路径列表。
   */
  getFieldsSnapshot<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /**
   * 根据是否提供路径列表读取完整或局部快照。
   */
  getFieldsSnapshot<TName extends NamePath<TValues>>(
    paths?: TName[]
  ): TValues | Partial<TValues> {
    return paths === undefined
      ? this.readFullSnapshot()
      : this.fieldState.getFieldsSnapshot(paths)
  }

  /**
   * 读取指定字段的 reset baseline。
   *
   * @param path 要读取的字段路径。
   * @returns 字段初始值或 `undefined`。
   */
  getInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return this.fieldState.getInitialValue(path)
  }

  /**
   * 返回完整 reset baseline。
   */
  getInitialValues(): Partial<TValues>
  /**
   * 返回指定字段的 reset baseline 子集。
   *
   * @param paths 要读取的字段路径列表。
   */
  getInitialValues<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /**
   * 根据是否提供路径列表读取完整或局部初始值。
   */
  getInitialValues<TName extends NamePath<TValues>>(paths?: TName[]): Partial<TValues> {
    return paths === undefined
      ? this.fieldState.getInitialValues()
      : this.fieldState.getInitialValues(paths)
  }

  /**
   * 设置单个字段的 reset baseline。
   *
   * @param path 要更新初始值的字段路径。
   * @param value 新的字段初始值。
   */
  setInitialValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName>
  ): void {
    this.fieldState.setInitialValue(path, value)
  }

  /**
   * 批量设置字段的 reset baseline。
   *
   * @param values 要写入的完整或部分初始值。
   */
  setInitialValues(values: Partial<TValues>): void {
    const entries = this.fieldState.collectValueEntries(values)

    if (entries.length === 0) return

    batchUpdates(() => {
      for (const [path, value] of entries) {
        this.setInitialValue(path, value as FieldValue<TValues, typeof path>)
      }
    })
  }

  /**
   * 读取单个字段 touched 状态。
   *
   * @param path 要读取状态的字段路径。
   * @returns 字段是否已被触碰。
   */
  isFieldTouched<TName extends NamePath<TValues>>(path: TName): boolean {
    return this.fieldState.isFieldTouched(path)
  }

  /**
   * 判断是否存在任一 touched 字段。
   */
  isFieldsTouched(): boolean
  /**
   * 判断指定字段是否全部 touched。
   *
   * @param paths 要检查的字段路径列表。
   */
  isFieldsTouched<TName extends NamePath<TValues>>(paths: TName[]): boolean
  /**
   * 根据是否提供路径列表执行 touched 状态判断。
   */
  isFieldsTouched<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    return paths === undefined
      ? this.fieldState.isFieldsTouched()
      : this.fieldState.isFieldsTouched(paths)
  }

  /**
   * 返回当前 touched 字段路径。
   */
  getTouchedFields(): NamePath<TValues>[] {
    return this.fieldState.getTouchedFields()
  }

  /**
   * 设置单个字段 touched 状态。
   *
   * @param path 要更新状态的字段路径。
   * @param touched 是否标记为已触碰。
   */
  setFieldTouched<TName extends NamePath<TValues>>(path: TName, touched: boolean): void {
    this.fieldState.setFieldTouched(path, touched)
  }

  /**
   * 批量设置字段 touched 状态。
   *
   * @param paths 要更新状态的字段路径列表。
   * @param touched 要写入的 touched 值，默认是 `true`。
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
   * 读取单个字段 pending 状态。
   *
   * @param path 要读取状态的字段路径。
   * @returns 字段是否处于 pending 状态。
   */
  isFieldPending<TName extends NamePath<TValues>>(path: TName): boolean {
    return this.fieldState.isFieldPending(path)
  }

  /**
   * 判断是否存在任一 pending 字段。
   */
  isFieldsPending(): boolean
  /**
   * 判断指定字段是否全部 pending。
   *
   * @param paths 要检查的字段路径列表。
   */
  isFieldsPending<TName extends NamePath<TValues>>(paths: TName[]): boolean
  /**
   * 根据是否提供路径列表执行 pending 状态判断。
   */
  isFieldsPending<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    return paths === undefined
      ? this.fieldState.isFieldsPending()
      : this.fieldState.isFieldsPending(paths)
  }

  /**
   * 返回当前 pending 字段及其消息。
   */
  getPendingFields(): StorePending<TValues, NamePath<TValues>>[] {
    return this.fieldState.getPendingFields()
  }

  /**
   * 设置单个字段 pending 状态及消息。
   *
   * @param path 要更新状态的字段路径。
   * @param pending 是否标记为 pending。
   * @param message pending 时关联的消息或消息列表。
   */
  setFieldPending<TName extends NamePath<TValues>>(
    path: TName,
    pending: boolean,
    message?: string | string[]
  ): void {
    this.fieldState.setFieldPending(path, pending, message)
  }

  /**
   * 批量设置字段 pending 状态及消息。
   *
   * @param paths 要更新状态的字段路径列表。
   * @param pending 要写入的 pending 值，默认是 `true`。
   * @param message pending 时关联的消息或消息列表。
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
   * 重置单个字段；数组根由 FieldArrayStore 统一处理。
   *
   * @param path 要重置的字段路径。
   */
  resetField<TName extends NamePath<TValues>>(path: TName): void {
    batchUpdates(() => {
      const resolved = this.registry.resolve(path)

      if (resolved?.owner.kind === "fieldArray" && resolved.isRoot) {
        const initialValue = this.fieldState.getInitialValue(path)

        this.fieldArray.replaceRoot(path, initialValue, { mode: "reset" })

        return
      }

      this.fieldState.resetField(path)
    })
  }

  /**
   * 在同一批处理中重置多个字段。
   *
   * @param paths 要重置的字段路径列表。
   */
  resetFields<TName extends NamePath<TValues>>(paths: TName[]): void {
    batchUpdates(() => {
      for (const path of paths) {
        this.resetField(path)
      }
    })
  }

  /**
   * 重置 Store；传入 values 时同时替换 reset baseline。
   *
   * @param values 可选的新完整或部分初始值。
   */
  reset(values?: Partial<TValues>): void {
    const resetValues = cloneDeep(values ?? this.fieldState.getInitialValues())

    if (values !== undefined) {
      this.fieldState.replaceInitialValues(resetValues)
    }

    const nextEntries = this.fieldState.collectValueEntries(resetValues)

    const nextPathSet = new Set(nextEntries.map(([path]) => createFieldKey(path)))

    const owners = this.registry.list()

    batchUpdates(() => {
      for (const owner of owners) {
        const nextValue = getByPath(resetValues, owner.path)

        if (owner.kind === "fieldArray") {
          this.fieldState.setOwnerInitialValue(owner.path, nextValue)
          this.fieldArray.replaceRoot(owner.path, nextValue, { mode: "reset" })

          continue
        }

        this.fieldState.resetOwner(owner, nextValue, nextPathSet.has(owner.key))
      }

      this.fieldState.reconcileUnowned(nextEntries, nextPathSet)
    })
  }

  /**
   * 获取指定数组根的内部 Handle。
   *
   * @param path 动态数组字段路径。
   * @returns 与数组根绑定的 FieldArray Handle。
   */
  getFieldArrayHandle<TPath extends FieldArrayPath<TValues>>(
    path: TPath
  ): FieldArrayHandle<FieldArrayItemValue<FieldValue<TValues, TPath>>> {
    return this.fieldArray.getFieldArrayHandle(path)
  }

  /**
   * 清理各子模块，释放 Store 持有的响应式资源。
   */
  destroy(): void {
    this.snapshot.destroy()
    this.fieldArray.destroy()
    this.fieldState.destroy()
    this.registry.clear()
  }
}

/**
 * 创建 Store 实例的工厂函数。
 *
 * @typeParam TValues 表单值对象类型。
 * @param options Store 初始值配置。
 * @returns 具备公开 Store 能力的实例。
 * @example
 * ```ts
 * const store = createStore<FormValues>({ initialValues })
 * ```
 */
export function createStore<TValues extends Values = Values>(
  options: StoreOptions<TValues> = {}
): Store<TValues> {
  return new StoreImpl<TValues>(options)
}
