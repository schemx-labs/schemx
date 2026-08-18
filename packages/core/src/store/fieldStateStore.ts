/**
 * 管理字段 Signal、初始值以及字段交互状态。
 */
import { cloneDeep, isEqual } from "es-toolkit"

import { createFieldSignal, createFieldSignalMap, type FieldSignal } from "../reactivity"
import {
  collectObjectPathsByLeaf,
  createFieldKey,
  getByPath,
  isDescendantFieldPath,
  setByPath,
  toNamePathSegments,
} from "../utils"

import {
  type OwnedSubtree,
  OwnedSubtreeRegistry,
  type ResolvedOwnedPath,
} from "./ownedSubtree"

import type { FieldArrayChange } from "../fieldArray"
import type { FieldValue, NamePath, Values } from "../types"
import type { StorePending } from "./types"
import type { FieldKey } from "../utils/path"

/**
 * 描述 FieldStateStore 的组合依赖。
 */
export interface FieldStateStoreOptions<TValues extends Values> {
  /**
   * 用于初始化字段 Signal 和 reset baseline 的初始值。
   */
  readonly initialValues?: Partial<TValues>
  /**
   * 负责解析字段是否属于某个 owner。
   */
  readonly registry: OwnedSubtreeRegistry<TValues>
  /**
   * 标记值变化，使完整快照在当前 batch 后失效。
   */
  readonly markValueChanged: (path: NamePath<TValues>) => void
}

/**
 * 管理字段 Signal、初始值和 touched/pending 状态。
 */
class FieldStateStoreImpl<TValues extends Values> {
  /**
   * 按字段路径保存当前值、初始值和交互状态 Signal。
   */
  private readonly fieldSignals = createFieldSignalMap<NamePath<TValues>, unknown>()
  /**
   * 共享的 owner 注册表。
   */
  private readonly registry: OwnedSubtreeRegistry<TValues>
  /**
   * 通知快照管理器值发生变化的回调。
   */
  private readonly markValueChanged: (path: NamePath<TValues>) => void
  /**
   * 与当前字段值隔离的 reset baseline。
   */
  private initialValues: Partial<TValues>

  /**
   * 初始化字段状态，并为初始值叶子创建基础 Signal。
   *
   * @param options FieldStateStore 的组合依赖。
   */
  constructor(options: FieldStateStoreOptions<TValues>) {
    this.registry = options.registry
    this.markValueChanged = options.markValueChanged
    this.initialValues = cloneDeep(options.initialValues ?? {})

    const paths = collectObjectPathsByLeaf<TValues, NamePath<TValues>>(this.initialValues)

    for (const path of paths) {
      const value = getByPath<TValues, typeof path>(this.initialValues, path)

      this.fieldSignals.set(
        path,
        createFieldSignal<typeof value>({
          value,
          initialValue: value,
        })
      )
    }
  }

  /**
   * 读取指定字段的当前值，并在响应式读取中建立依赖。
   *
   * @param path 要读取的字段路径。
   * @returns 当前字段值；尚未建立值时返回 `undefined`。
   */
  getFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    const resolved = this.registry.resolve(path)

    if (resolved) {
      return this.getOrCreateOwnedSignal(path, resolved).value.value
    }

    const signal = this.fieldSignals.get(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    return signal?.value.value
  }

  /**
   * 读取指定字段的当前值，但不建立响应式依赖。
   *
   * @param path 要读取的字段路径。
   * @returns 当前字段值；尚未建立值时返回 `undefined`。
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    const resolved = this.registry.resolve(path)

    if (resolved) {
      return this.getOrCreateOwnedSignal(path, resolved).value.peek()
    }

    const signal = this.fieldSignals.peek(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    return signal?.value.peek()
  }

  /**
   * 读取指定字段的 reset baseline。
   *
   * @param path 要读取的字段路径。
   * @returns 字段初始值；路径没有值时返回 `undefined`。
   */
  getInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    const resolved = this.registry.resolve(path)

    if (resolved) {
      return this.getOrCreateOwnedSignal(path, resolved).initialValue.peek()
    }

    const signal = this.fieldSignals.peek(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    return (
      signal?.initialValue.peek() ?? getByPath<TValues, TName>(this.initialValues, path)
    )
  }

  /**
   * 返回完整初始值的副本。
   *
   * @returns 不包含响应式依赖的初始值副本。
   */
  getInitialValues(): Partial<TValues>
  /**
   * 返回指定路径的初始值子集。
   *
   * @param paths 要读取的字段路径列表。
   * @returns 只包含指定路径的初始值子集。
   */
  getInitialValues<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /**
   * 根据是否提供路径列表执行完整或局部初始值读取。
   */
  getInitialValues(paths?: NamePath<TValues>[]): Partial<TValues> {
    if (paths === undefined) {
      return cloneDeep(this.initialValues)
    }

    const result = {} as Partial<TValues>

    for (const path of paths) {
      setByPath(result, path, getByPath<TValues, typeof path>(this.initialValues, path))
    }

    return result
  }

  /**
   * 获取完整当前值的无依赖快照。
   */
  buildFullSnapshot(): TValues {
    const result = {} as TValues

    for (const path of this.getOwnedFieldPaths()) {
      setByPath(result, path, this.getFieldSnapshot(path))
    }

    return result
  }

  /**
   * 返回快照构建时应直接写入的字段根。
   */
  getSnapshotEntries(): readonly [NamePath<TValues>, unknown][] {
    return this.getOwnedFieldPaths().map((path) => [path, this.getFieldSnapshot(path)])
  }

  /**
   * 读取全部字段的当前值。
   *
   * @returns 包含当前字段值的完整对象。
   */
  getFieldsValue(): TValues
  /**
   * 读取指定字段的当前值。
   *
   * @param paths 要读取的字段路径列表。
   * @returns 包含指定字段值的局部对象。
   */
  getFieldsValue<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /**
   * 根据是否提供路径列表执行完整或局部当前值读取。
   */
  getFieldsValue<TName extends NamePath<TValues>>(
    paths?: TName[]
  ): TValues | Partial<TValues> {
    const result = {} as Partial<TValues>

    const pathsToRead = paths ?? this.getOwnedFieldPaths()

    for (const path of pathsToRead) {
      setByPath(result, path, this.getFieldValue(path))
    }

    return result as TValues | Partial<TValues>
  }

  /**
   * 读取全部字段的无依赖当前值。
   *
   * @returns 包含当前字段快照的完整对象。
   */
  getFieldsSnapshot(): TValues
  /**
   * 读取指定字段的无依赖当前值。
   *
   * @param paths 要读取的字段路径列表。
   * @returns 包含指定字段快照的局部对象。
   */
  getFieldsSnapshot<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  /**
   * 根据是否提供路径列表执行完整或局部快照读取。
   */
  getFieldsSnapshot<TName extends NamePath<TValues>>(
    paths?: TName[]
  ): TValues | Partial<TValues> {
    if (paths === undefined) {
      return this.buildFullSnapshot()
    }

    const result = {} as Partial<TValues>

    for (const path of paths) {
      setByPath(result, path, this.getFieldSnapshot(path))
    }

    return result
  }

  /**
   * 按 owner 边界拆分批量值，避免复合 owner 被递归拆成多个写入。
   *
   * @param values 要拆分的批量字段值。
   * @returns 按字段路径排列的值条目。
   */
  collectValueEntries(values: Partial<TValues>): Array<[NamePath<TValues>, unknown]> {
    const entries: Array<[NamePath<TValues>, unknown]> = []

    /**
     * 递归访问值并在 owner 边界生成一条写入条目。
     *
     * @param value 当前递归节点的值。
     * @param path 当前节点对应的字符串路径。
     */
    const visit = (value: unknown, path: string): void => {
      const name = path as NamePath<TValues>

      if (this.registry.has(name)) {
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
   * 设置字段当前值；数组根由 FieldArrayStore 单独处理。
   *
   * @param path 要写入的字段路径。
   * @param value 要写入的字段值；`undefined` 表示清空该路径。
   */
  setFieldValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void {
    if (this.setOwnedDescendantValue(path, value)) return

    const resolved = this.registry.resolve(path)

    const existingSignal = this.fieldSignals.peek(path)

    const signal = this.getOrCreateFieldSignal(path)

    if (existingSignal && isEqual(signal.value.peek(), value)) return

    signal.setValue(value)

    if (resolved) {
      this.syncOwnedDescendants(resolved.owner.path, value)
      this.markValueChanged(resolved.owner.path)
    } else {
      this.markValueChanged(path)
    }
  }

  /**
   * 设置字段 reset baseline，并同步所属 owner 的后代初始 Signal。
   *
   * @param path 要更新初始值的字段路径。
   * @param value 新的字段初始值。
   */
  setInitialValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName>
  ): void {
    setByPath(this.initialValues, path, value)

    const resolved = this.registry.resolve(path)

    if (!resolved) {
      this.getOrCreateFieldSignal(path).setInitialValue(value)

      return
    }

    const signal = this.getOrCreateOwnedSignal(path, resolved)

    if (resolved.isRoot) {
      signal.setInitialValue(value)
      this.syncOwnedDescendantInitialValues(resolved.owner.path, value)

      return
    }

    this.setOwnedDescendantInitialValue(path, resolved, value)
  }

  /**
   * 替换整份 reset baseline，供 `Store.reset(values)` 使用。
   *
   * @param values 新的完整或部分初始值。
   */
  replaceInitialValues(values: Partial<TValues>): void {
    this.initialValues = cloneDeep(values)
  }

  /**
   * 读取字段 touched 状态。
   *
   * @param path 要读取状态的字段路径。
   * @returns 字段是否已被触碰。
   */
  isFieldTouched<TName extends NamePath<TValues>>(path: TName): boolean {
    const resolved = this.registry.resolve(path)

    if (resolved) {
      return this.getOrCreateOwnedSignal(path, resolved).touched.value
    }

    return this.fieldSignals.get(path)?.touched.value ?? false
  }

  /**
   * 判断是否存在任一字段被触碰。
   *
   * @returns 是否至少有一个字段为 touched。
   */
  isFieldsTouched(): boolean
  /**
   * 判断指定字段是否全部被触碰。
   *
   * @param paths 要检查的字段路径列表。
   * @returns 所有指定字段是否均为 touched。
   */
  isFieldsTouched<TName extends NamePath<TValues>>(paths: TName[]): boolean
  /**
   * 根据是否提供路径列表执行 touched 状态判断。
   */
  isFieldsTouched<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    const pathsToRead = paths ?? [...this.fieldSignals.keys()]

    return paths === undefined
      ? pathsToRead.some((path) => this.isFieldTouched(path))
      : pathsToRead.every((path) => this.isFieldTouched(path))
  }

  /**
   * 返回当前已被触碰的字段路径。
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
   * 设置单个字段 touched 状态。
   *
   * @param path 要更新状态的字段路径。
   * @param touched 是否标记为已触碰。
   */
  setFieldTouched<TName extends NamePath<TValues>>(path: TName, touched: boolean): void {
    this.getOrCreateSignalForPath(path).setTouched(touched)
  }

  /**
   * 读取字段 pending 状态。
   *
   * @param path 要读取状态的字段路径。
   * @returns 字段是否处于 pending 状态。
   */
  isFieldPending<TName extends NamePath<TValues>>(path: TName): boolean {
    const resolved = this.registry.resolve(path)

    if (resolved) {
      return this.getOrCreateOwnedSignal(path, resolved).pending.value
    }

    return this.fieldSignals.get(path)?.pending.value ?? false
  }

  /**
   * 判断是否存在任一字段处于 pending。
   *
   * @returns 是否至少有一个字段为 pending。
   */
  isFieldsPending(): boolean
  /**
   * 判断指定字段是否全部处于 pending。
   *
   * @param paths 要检查的字段路径列表。
   * @returns 所有指定字段是否均为 pending。
   */
  isFieldsPending<TName extends NamePath<TValues>>(paths: TName[]): boolean
  /**
   * 根据是否提供路径列表执行 pending 状态判断。
   */
  isFieldsPending<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    if (paths) {
      return paths.every((path) => this.isFieldPending(path))
    }

    return [...this.fieldSignals.keys()].some((path) => this.isFieldPending(path))
  }

  /**
   * 返回当前 pending 字段及其消息。
   */
  getPendingFields(): StorePending<TValues, NamePath<TValues>>[] {
    const fields: StorePending<TValues, NamePath<TValues>>[] = []

    for (const [field, signal] of this.fieldSignals.entries()) {
      if (signal.pending.value) {
        fields.push({
          field,
          message: signal.pendingMessage.value,
        })
      }
    }

    return fields
  }

  /**
   * 设置单个字段 pending 状态及可选消息。
   *
   * @param path 要更新状态的字段路径。
   * @param pending 是否标记为 pending。
   * @param message pending 时向调用方暴露的消息或消息列表。
   */
  setFieldPending<TName extends NamePath<TValues>>(
    path: TName,
    pending: boolean,
    message?: string | string[]
  ): void {
    this.getOrCreateSignalForPath(path).setPending(pending, message)
  }

  /**
   * 重置普通字段；数组根由 FieldArrayStore 单独处理。
   *
   * @param path 要重置的字段路径。
   * @throws 当 path 是 FieldArray 根时抛出错误，要求由数组存储执行 reset。
   */
  resetField<TName extends NamePath<TValues>>(path: TName): void {
    const resolved = this.registry.resolve(path)

    if (resolved?.owner.kind === "fieldArray" && resolved.isRoot) {
      throw new Error("[schemx] FieldArray roots must be reset by FieldArrayStore.")
    }

    if (resolved) {
      this.resetOwnedField(path, resolved)

      return
    }

    const signal = this.getOrCreateFieldSignal(path)

    const initialValue = signal.initialValue.peek()

    if (!isEqual(signal.value.peek(), initialValue)) {
      this.markValueChanged(path)
    }

    signal.reset()
  }

  /**
   * 重置普通 owner 的根值，供 `StoreImpl.reset` 使用。
   *
   * @param owner 要重置的普通字段 owner。
   * @param nextValue reset 后 owner 应采用的值。
   * @param hasNextValue 指示 reset 输入中是否包含该 owner 路径。
   * @throws 当 owner 实际上是 FieldArray 时抛出错误。
   */
  resetOwner(
    owner: OwnedSubtree<TValues>,
    nextValue: unknown,
    hasNextValue: boolean
  ): void {
    if (owner.kind === "fieldArray") {
      throw new Error("[schemx] FieldArray owners must be reset by FieldArrayStore.")
    }

    const existingSignal = this.fieldSignals.peek(owner.path)

    if (!hasNextValue) {
      this.syncOwnedDescendants(owner.path, undefined)
      this.syncOwnedDescendantInitialValues(owner.path, undefined)
      this.resetDescendantSignals(owner.path)

      if (existingSignal) {
        const previousValue = existingSignal.value.peek()

        existingSignal.reset(undefined)
        this.fieldSignals.delete(owner.path)

        if (previousValue !== undefined) {
          this.markValueChanged(owner.path)
        }
      }

      return
    }

    const signal = this.getOrCreateFieldSignal(owner.path)

    const previousValue = signal.value.peek()

    signal.setInitialValue(nextValue as never)
    signal.reset(nextValue as never)
    this.syncOwnedDescendants(owner.path, nextValue)
    this.syncOwnedDescendantInitialValues(owner.path, nextValue)
    this.resetDescendantSignals(owner.path)

    if (!isEqual(previousValue, nextValue)) {
      this.markValueChanged(owner.path)
    }
  }

  /**
   * 重建未归属 owner 的字段 Signal。
   *
   * @param entries reset 输入拆分后的字段值条目。
   * @param nextPathSet reset 输入中存在的字段路径集合。
   */
  reconcileUnowned(
    entries: readonly [NamePath<TValues>, unknown][],
    nextPathSet: ReadonlySet<FieldKey>
  ): void {
    for (const path of [...this.fieldSignals.keys()]) {
      if (!this.registry.resolve(path) && !nextPathSet.has(createFieldKey(path))) {
        this.fieldSignals.delete(path)
        this.markValueChanged(path)
      }
    }

    for (const [path, value] of entries) {
      if (this.registry.resolve(path)) continue

      const next = value as FieldValue<TValues, typeof path>

      const signal = this.fieldSignals.peek(path)

      if (signal) {
        if (!isEqual(signal.value.peek(), next)) {
          this.markValueChanged(path)
        }

        signal.setInitialValue(next)
        signal.reset(next)
        continue
      }

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

  /**
   * 在 owner 注册完成后按需建立 owner 根或后代 Signal。
   *
   * @param path 要实体化的字段路径。
   * @param resolved 该路径相对于 owner 的解析结果。
   */
  materializeOwnedSignal<TName extends NamePath<TValues>>(
    path: TName,
    resolved: ResolvedOwnedPath<TValues> | undefined
  ): void {
    if (resolved) {
      this.getOrCreateOwnedSignal(path, resolved)
    }
  }

  /**
   * 在 owner 注册完成后写入 owner 根的当前值和初始值。
   *
   * @param path owner 根路径。
   * @param currentValue owner 当前值。
   * @param initialValue owner 初始值。
   */
  adoptOwnerRoot(
    path: NamePath<TValues>,
    currentValue: unknown,
    initialValue: unknown
  ): void {
    const rootSignal = this.getOrCreateFieldSignal(path)

    rootSignal.setInitialValue(initialValue as never)
    rootSignal.setValue(currentValue as never)
    this.syncOwnedDescendants(path, currentValue)
    this.syncOwnedDescendantInitialValues(path, initialValue)
  }

  /**
   * 写入已注册 owner 根的当前值，不负责 revision。
   *
   * @param path owner 根路径。
   * @param value 要写入的当前值。
   */
  setOwnerCurrentValue(path: NamePath<TValues>, value: unknown): void {
    const signal = this.getOrCreateFieldSignal(path)

    signal.setValue(value as never)
    this.syncOwnedDescendants(path, value)
  }

  /**
   * 写入已注册 owner 根的初始值，不负责 revision。
   *
   * @param path owner 根路径。
   * @param value 要写入的初始值。
   */
  setOwnerInitialValue(path: NamePath<TValues>, value: unknown): void {
    setByPath(this.initialValues, path, value as never)

    const signal = this.getOrCreateFieldSignal(path)

    signal.setInitialValue(value as never)
    this.syncOwnedDescendantInitialValues(path, value)
  }

  /**
   * 将 owner 根当前值同步到已实体化的后代 Signal。
   *
   * @param path owner 根路径。
   * @param value owner 的最新当前值。
   */
  syncOwnedDescendants(path: NamePath<TValues>, value: unknown): void {
    const ownerSegments = toNamePathSegments(path)

    for (const [fieldPath, signal] of this.fieldSignals.entries()) {
      if (!isDescendantFieldPath(fieldPath, path)) continue

      const relativePath = toNamePathSegments(fieldPath).slice(ownerSegments.length)

      const nextValue = getByPath(
        value as Partial<TValues>,
        relativePath as NamePath<TValues>
      )

      if (!isEqual(signal.value.peek(), nextValue)) {
        signal.setValue(nextValue)
      }
    }
  }

  /**
   * 将 owner 根初始值同步到已实体化的后代 Signal。
   *
   * @param path owner 根路径。
   * @param value owner 的最新初始值。
   */
  syncOwnedDescendantInitialValues(path: NamePath<TValues>, value: unknown): void {
    const ownerSegments = toNamePathSegments(path)

    for (const [fieldPath, signal] of this.fieldSignals.entries()) {
      if (!isDescendantFieldPath(fieldPath, path)) continue

      const relativePath = toNamePathSegments(fieldPath).slice(ownerSegments.length)

      const nextValue = getByPath(
        value as Partial<TValues>,
        relativePath as NamePath<TValues>
      )

      if (!isEqual(signal.initialValue.peek(), nextValue)) {
        signal.setInitialValue(nextValue)
      }
    }
  }

  /**
   * 清理数组结构变化影响范围内的 touched/pending。
   *
   * @param path 数组根路径。
   * @param change 数组结构变化及受影响索引范围。
   */
  clearArrayTransientState(path: NamePath<TValues>, change: FieldArrayChange): void {
    if (change.ranges.length === 0 && !change.resetKeys) return

    const ownerSegments = toNamePathSegments(path)

    const isAffectedIndex = (index: number): boolean =>
      change.ranges.some((range) => index >= range.start && index <= range.end)

    const clearSignal = (signal: FieldSignal<unknown>): void => {
      signal.setTouched(false)
      signal.setPending(false)
    }

    const rootSignal = this.fieldSignals.peek(path)

    if (rootSignal) clearSignal(rootSignal)

    for (const [fieldPath, signal] of this.fieldSignals.entries()) {
      if (!isDescendantFieldPath(fieldPath, path)) continue

      const segments = toNamePathSegments(fieldPath)

      const relativeIndex = Number(segments[ownerSegments.length])

      if (Number.isInteger(relativeIndex) && isAffectedIndex(relativeIndex)) {
        clearSignal(signal)
      }
    }
  }

  /**
   * 清理字段 Signal，供 Store 销毁时释放资源。
   */
  destroy(): void {
    this.fieldSignals.clear()
  }

  /**
   * 返回指定数组根的当前值，不建立依赖。
   *
   * @param path 数组根路径。
   * @returns 数组当前值或 nullish 空状态。
   */
  getArrayValue(path: NamePath<TValues>): readonly unknown[] | null | undefined {
    return this.fieldSignals.peek(path)?.value.peek() as
      readonly unknown[] | null | undefined
  }

  /**
   * 获取或创建未按 owner 解析的字段 Signal。
   *
   * @param path 要获取 Signal 的字段路径。
   * @returns 与字段路径绑定的 Signal。
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
        initialValue,
      })
      this.fieldSignals.set(path, signal)
    }

    return signal
  }

  /**
   * 获取或创建 owner 根或 owner 后代字段 Signal。
   *
   * @param path 要获取 Signal 的字段路径。
   * @param resolved path 相对于 owner 的解析结果。
   * @returns 与字段路径绑定的 Signal。
   */
  private getOrCreateOwnedSignal<TName extends NamePath<TValues>>(
    path: TName,
    resolved: ResolvedOwnedPath<TValues>
  ): FieldSignal<FieldValue<TValues, TName>> {
    if (resolved.isRoot) {
      return this.getOrCreateFieldSignal(resolved.owner.path) as unknown as FieldSignal<
        FieldValue<TValues, TName>
      >
    }

    const existingSignal = this.fieldSignals.peek(path) as
      FieldSignal<FieldValue<TValues, TName>> | undefined

    if (existingSignal) return existingSignal

    const ownerSignal = this.getOrCreateFieldSignal(resolved.owner.path)

    const currentValue = getByPath(
      ownerSignal.value.peek() as Partial<TValues>,
      resolved.relativePath
    )

    const initialValue = getByPath(
      ownerSignal.initialValue.peek() as Partial<TValues>,
      resolved.relativePath
    )

    const signal = createFieldSignal<FieldValue<TValues, TName>>({
      value: currentValue as FieldValue<TValues, TName>,
      initialValue: initialValue as FieldValue<TValues, TName>,
    })

    this.fieldSignals.set(path, signal as FieldSignal<unknown>)

    return signal
  }

  /**
   * 按路径是否属于 owner 选择对应的 Signal 创建策略。
   *
   * @param path 要获取 Signal 的字段路径。
   * @returns 与字段路径绑定的 Signal。
   */
  private getOrCreateSignalForPath<TName extends NamePath<TValues>>(
    path: TName
  ): FieldSignal<FieldValue<TValues, TName>> {
    const resolved = this.registry.resolve(path)

    return resolved
      ? this.getOrCreateOwnedSignal(path, resolved)
      : this.getOrCreateFieldSignal(path)
  }

  /**
   * 更新 owner 后代值，并将变化合并回 owner 根。
   *
   * @param path 要更新的后代字段路径。
   * @param value 后代字段的新值。
   * @returns 是否已按 owner 后代语义处理该路径。
   */
  private setOwnedDescendantValue<TName extends NamePath<TValues>>(
    path: TName,
    value: FieldValue<TValues, TName> | undefined
  ): boolean {
    const resolved = this.registry.resolve(path)

    if (!resolved || resolved.isRoot) return false

    const ownerPath = resolved.owner.path

    const ownerSignal = this.getOrCreateFieldSignal(ownerPath)

    const currentOwnerValue = ownerSignal.value.peek()

    const currentOwnerChild = getByPath(
      currentOwnerValue as Partial<TValues>,
      resolved.relativePath
    )

    if (isEqual(currentOwnerChild, value)) return true

    this.getOrCreateOwnedSignal(path, resolved)

    const relativeSegments = toNamePathSegments(resolved.relativePath)

    const nextOwnerValue = cloneDeep(
      currentOwnerValue ?? (/^\d+$/.test(String(relativeSegments[0])) ? [] : {})
    ) as Partial<TValues>

    setByPath(nextOwnerValue, resolved.relativePath, value as never)

    if (!isEqual(currentOwnerValue, nextOwnerValue)) {
      ownerSignal.setValue(nextOwnerValue as never)
      this.syncOwnedDescendants(ownerPath, nextOwnerValue)
      this.markValueChanged(ownerPath)
    }

    return true
  }

  /**
   * 更新 owner 后代初始值，并将变化合并回 owner 根。
   *
   * @param path 要更新的后代字段路径。
   * @param resolved path 相对于 owner 的解析结果。
   * @param value 后代字段的新初始值。
   */
  private setOwnedDescendantInitialValue<TName extends NamePath<TValues>>(
    path: TName,
    resolved: ResolvedOwnedPath<TValues>,
    value: FieldValue<TValues, TName>
  ): void {
    const ownerSignal = this.getOrCreateFieldSignal(resolved.owner.path)

    const currentInitialValue = ownerSignal.initialValue.peek()

    const relativeSegments = toNamePathSegments(resolved.relativePath)

    const nextInitialValue = cloneDeep(
      currentInitialValue ?? (/^\d+$/.test(String(relativeSegments[0])) ? [] : {})
    ) as Partial<TValues>

    setByPath(nextInitialValue, resolved.relativePath, value as never)
    ownerSignal.setInitialValue(nextInitialValue as never)
    this.syncOwnedDescendantInitialValues(resolved.owner.path, nextInitialValue)

    const signal = this.getOrCreateOwnedSignal(path, resolved)

    if (!isEqual(signal.initialValue.peek(), value)) {
      signal.setInitialValue(value)
    }
  }

  /**
   * 按 owner 语义重置根字段或后代字段。
   *
   * @param path 要重置的字段路径。
   * @param resolved path 相对于 owner 的解析结果。
   */
  private resetOwnedField<TName extends NamePath<TValues>>(
    path: TName,
    resolved: ResolvedOwnedPath<TValues>
  ): void {
    const signal = this.getOrCreateOwnedSignal(path, resolved)

    const initialValue = signal.initialValue.peek()

    const ownerSignal = this.getOrCreateFieldSignal(resolved.owner.path)

    if (resolved.isRoot) {
      const currentValue = ownerSignal.value.peek()

      ownerSignal.reset(initialValue)
      this.syncOwnedDescendants(resolved.owner.path, initialValue)
      this.resetDescendantSignals(resolved.owner.path)

      if (!isEqual(currentValue, initialValue)) {
        this.markValueChanged(resolved.owner.path)
      }

      return
    }

    const currentOwnerValue = ownerSignal.value.peek()

    const relativeSegments = toNamePathSegments(resolved.relativePath)

    const nextOwnerValue = cloneDeep(
      currentOwnerValue ?? (/^\d+$/.test(String(relativeSegments[0])) ? [] : {})
    ) as Partial<TValues>

    setByPath(nextOwnerValue, resolved.relativePath, initialValue as never)

    if (!isEqual(currentOwnerValue, nextOwnerValue)) {
      ownerSignal.setValue(nextOwnerValue as never)
      this.syncOwnedDescendants(resolved.owner.path, nextOwnerValue)
      this.markValueChanged(resolved.owner.path)
    }

    signal.reset(initialValue)
  }

  /**
   * 重置指定 owner 下已实体化的后代 Signal。
   *
   * @param path owner 根路径。
   */
  private resetDescendantSignals(path: NamePath<TValues>): void {
    for (const [fieldPath, signal] of this.fieldSignals.entries()) {
      if (isDescendantFieldPath(fieldPath, path)) {
        signal.reset()
      }
    }
  }

  /**
   * 返回应作为完整快照根节点写入的字段路径。
   */
  private getOwnedFieldPaths(): NamePath<TValues>[] {
    return [...this.fieldSignals.keys()].filter((path) => {
      const resolved = this.registry.resolve(path)

      return resolved === undefined || resolved.isRoot
    })
  }
}

/**
 * 暴露字段状态存储的内部能力，不暴露其构造方式。
 */
export type FieldStateStore<TValues extends Values> = FieldStateStoreImpl<TValues>

/**
 * 创建字段状态存储。
 *
 * @typeParam TValues 表单值对象类型。
 * @param options FieldStateStore 的组合依赖。
 * @returns 可供 Store 组合根使用的字段状态存储。
 * @example
 * ```ts
 * const fieldState = createFieldStateStore<FormValues>(options)
 * ```
 */
export function createFieldStateStore<TValues extends Values>(
  options: FieldStateStoreOptions<TValues>
): FieldStateStore<TValues> {
  return new FieldStateStoreImpl<TValues>(options)
}
