/**
 * Store 的唯一实现。
 *
 * 当前值、初始值、字段交互状态和注册路径均由 FieldSignalMap 统一持有；Store
 * 只协调全表 revision、快照和动态数组结构。
 *
 * @module core/store/store
 */
import { cloneDeep } from "es-toolkit"

import { batchUpdates, createSignal, createSignalWatch, type Signal } from "../reactivity"
import {
  areOverlappingFieldPaths,
  collectObjectPathsByLeaf,
  createFieldKey,
  getByPath,
  isDescendantFieldPath,
  normalizeNamePath,
  setByPath,
} from "../utils"

import { createFieldSignalMap, type FieldSignalMap } from "./fieldSignalMap"

import type {
  FieldArrayChange,
  FieldArrayPath,
  FieldValue,
  NamePath,
  SetValueAction,
  SetValuesAction,
  Values,
} from "../types"
import type {
  ArrayStructureHandle,
  Store,
  StoreFieldError,
  StoreOptions,
  StorePending,
} from "./types"
import type { FieldKey } from "../utils/path"
import type { ValidationRuleIssue } from "../validator/types"

// 保存动态数组的行 key 和最近一次结构变更，不保存数组值。
interface ArrayState<TValues extends Values> {
  // 数组根路径。
  readonly path: NamePath<TValues>
  // 当前行 key 列表；其长度必须与数组值长度一致。
  readonly keys: Signal<readonly string[]>
  // 当前批次最后一次数组结构变更。
  readonly change: Signal<FieldArrayChange | undefined>
  // 下一个行 key 的单调递增序号。
  nextKey: number
}

/**
 * 解析单字段直接值或函数式 updater。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param action - 直接字段值或基于旧值计算新值的 updater。
 * @param previousValue - 当前字段值；字段不存在时为 `undefined`。
 * @returns 解析后的字段值。
 */
function resolveSetValueAction<TValues extends Values, TName extends NamePath<TValues>>(
  action: SetValueAction<TValues, TName>,
  previousValue: FieldValue<TValues, TName> | undefined
): FieldValue<TValues, TName> | undefined {
  if (typeof action !== "function") {
    return action
  }

  return (
    action as (
      previousValue: FieldValue<TValues, TName>
    ) => FieldValue<TValues, TName> | undefined
  )(previousValue as FieldValue<TValues, TName>)
}

/**
 * 解析批量直接值或函数式 updater。
 *
 * @typeParam TValues - 表单值类型。
 * @param action - 部分表单值或基于旧值计算下一部分值的 updater。
 * @param previousValues - 当前完整表单值快照。
 * @returns 解析后的部分表单值。
 */
function resolveSetValuesAction<TValues extends Values>(
  action: SetValuesAction<TValues>,
  previousValues: TValues
): Partial<TValues> {
  if (typeof action !== "function") {
    return action
  }

  return (action as (previousValues: Readonly<TValues>) => Partial<TValues>)(
    previousValues
  )
}

// Store 的唯一状态实现，统一管理值、路径状态、数组结构和快照。
class StoreImpl<TValues extends Values = Values> implements Store<TValues> {
  // 管理唯一值树、字段级 revision 和 touched/pending 状态。
  private readonly fieldStates: FieldSignalMap<TValues>
  // 按规范化数组路径缓存数组结构状态。
  private readonly arrays = new Map<FieldKey, ArrayState<TValues>>()

  // 任意当前值变更都会递增的全表版本。
  private readonly formRevision = createSignal(0)
  // 任意初始值变更都会递增的初始值版本。
  private readonly initialFormRevision = createSignal(0)
  // 快照对应的当前值版本。
  private snapshotRevision = -1
  // 当前版本缓存的独立全表快照。
  private snapshotCache: TValues | undefined

  /**
   * 创建 Store，并深拷贝初始值以隔离调用方后续修改。
   *
   * @param options - Store 初始值配置。
   */
  constructor(options: StoreOptions<TValues> = {}) {
    this.fieldStates = createFieldSignalMap<TValues>({
      initialValues: options.initialValues,
      onValueChanged: () => {
        this.formRevision.value += 1
        this.snapshotRevision = -1
      },
      onInitialValueChanged: () => {
        this.initialFormRevision.value += 1
      },
    })
  }

  /**
   * 创建指定数组路径的 Runtime 结构句柄。
   *
   * 句柄只暴露数组路径注册、行 key 读取和结构订阅；数组值必须通过普通
   * `setFieldValue` 或 `setFieldsValue` 更新。
   *
   * @param path - 动态数组字段路径。
   * @returns 只读数组结构句柄。
   */
  getArrayStructureHandle<TPath extends FieldArrayPath<TValues>>(
    path: TPath
  ): ArrayStructureHandle {
    const register = (): void => {
      this.ensureArrayState(path)
    }

    const getKeys = (): readonly string[] => {
      return this.getArrayState(path).keys.value
    }

    const subscribe = (listener: (change: FieldArrayChange) => void): (() => void) => {
      const state = this.getArrayState(path)

      return createSignalWatch(
        () => state.change.value,
        (change) => {
          if (change !== undefined) {
            listener(change)
          }
        }
      )
    }

    return {
      register,
      getKeys,
      subscribe,
    }
  }

  /**
   * 注册字段路径，并惰性创建对应路径状态。
   *
   * 注册不会接管路径值，也不阻止父子路径同时存在。
   *
   * @param path - 要注册的字段路径。
   */
  registerFieldPath<TName extends NamePath<TValues>>(path: TName): void {
    this.fieldStates.registerFieldPath(path)
  }

  /**
   * 反注册字段路径，同时保留当前值、初始值和已缓存的路径状态。
   *
   * @param path - 要反注册的字段路径。
   */
  unregisterFieldPath<TName extends NamePath<TValues>>(path: TName): void {
    this.fieldStates.unregisterFieldPath(path)
  }

  /**
   * 在同一个响应式批次中注册多个字段路径。
   *
   * @param paths - 要注册的字段路径列表。
   */
  registerFieldPaths<TName extends NamePath<TValues>>(paths: TName[]): void {
    batchUpdates(() => {
      for (const path of paths) {
        this.registerFieldPath(path)
      }
    })
  }

  /**
   * 写入字段当前值；函数参数按 updater 解释。
   *
   * @param path - 要写入的字段路径。
   * @param action - 要写入的值或基于当前值计算下一值的 updater。
   */
  setFieldValue<TName extends NamePath<TValues>>(
    path: TName,
    action: SetValueAction<TValues, TName>
  ): void {
    batchUpdates(() => {
      const previousValue = this.fieldStates.peekFieldValue(path)

      const nextValue = resolveSetValueAction(action, previousValue)

      const arrayState = this.arrays.get(createFieldKey(path))

      if (arrayState) {
        this.updateArrayRoot(arrayState, nextValue)

        return
      }

      this.fieldStates.setFieldValue(path, nextValue)
    })
  }

  /**
   * 删除指定字段的当前值，并同步清理其 FieldArray 根状态。
   *
   * @param path - 要删除的字段路径；不会修改初始值。
   */
  removeFieldValue<TName extends NamePath<TValues>>(path: TName): void {
    batchUpdates(() => {
      const arrayState = this.arrays.get(createFieldKey(path))

      if (arrayState) {
        this.removeArrayRoot(arrayState)

        return
      }

      const previousArrayLengths = this.getNestedArrayLengths(path)

      this.fieldStates.removeFieldValue(path)
      this.rebuildNestedArrayKeys(path, previousArrayLengths)
    })
  }

  /**
   * 按叶子路径和已创建数组根批量写入当前值。
   *
   * @param action - 要合并写入的字段值对象或基于当前值计算下一值的 updater。
   */
  setFieldsValue(action: SetValuesAction<TValues>): void {
    const values = resolveSetValuesAction(
      action,
      this.fieldStates.peekFieldValue("" as NamePath<TValues>) as TValues
    )

    const paths = this.getBatchWritePaths(values)

    batchUpdates(() => {
      for (const path of paths) {
        const value = getByPath(values, path)

        const arrayState = this.arrays.get(createFieldKey(path))

        if (arrayState) {
          this.updateArrayRoot(arrayState, value)
        } else {
          this.fieldStates.setFieldValue(path, value)
        }
      }
    })
  }

  /**
   * 读取字段当前值，并为该路径建立细粒度响应式依赖。
   *
   * @param path - 要读取的字段路径。
   * @returns 当前值；路径不存在时返回 `undefined`。
   */
  getFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return this.fieldStates.getFieldValue(path)
  }

  /**
   * 读取单个字段的无依赖快照，并复制对象或数组值。
   *
   * @param path - 要读取的字段路径。
   * @returns 当前值快照；路径不存在时返回 `undefined`。
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return this.fieldStates.getFieldSnapshot(path)
  }

  /**
   * 读取全量当前值，并建立对全表 revision 的响应式依赖。
   *
   * @returns 当前值的独立副本。
   */
  getFieldsValue(): TValues
  /**
   * 读取指定路径的当前值，并仅建立这些路径的响应式依赖。
   *
   * @param paths - 要读取的字段路径列表。
   * @returns 指定路径组成的独立部分值。
   */
  getFieldsValue<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  // 根据是否提供路径列表分派全量或局部当前值读取。
  getFieldsValue<TName extends NamePath<TValues>>(
    paths?: TName[]
  ): TValues | Partial<TValues> {
    if (paths === undefined) {
      this.formRevision.value

      return this.fieldStates.getFieldSnapshot("" as NamePath<TValues>) as TValues
    }

    return this.buildPathValues(paths, true)
  }

  /**
   * 读取全量当前值快照，并在值版本不变时复用同一快照对象。
   *
   * @returns 当前值的无依赖独立快照。
   */
  getFieldsSnapshot(): TValues
  /**
   * 读取指定路径的无依赖当前值快照。
   *
   * @param paths - 要读取的字段路径列表。
   * @returns 指定路径组成的独立部分快照。
   */
  getFieldsSnapshot<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  // 根据是否提供路径列表分派全量或局部快照读取。
  getFieldsSnapshot<TName extends NamePath<TValues>>(
    paths?: TName[]
  ): TValues | Partial<TValues> {
    if (paths !== undefined) {
      return this.buildPathValues(paths, false)
    }

    const revision = this.formRevision.peek()

    if (this.snapshotRevision === revision && this.snapshotCache !== undefined) {
      return this.snapshotCache
    }

    this.snapshotCache = this.fieldStates.getFieldSnapshot(
      "" as NamePath<TValues>
    ) as TValues
    this.snapshotRevision = revision

    return this.snapshotCache
  }

  /**
   * 更新字段初始值，不改变当前值或 touched/pending 状态。
   *
   * @param path - 要更新的字段路径。
   * @param action - 新的初始值或基于当前初始值计算下一值的 updater。
   */
  setInitialValue<TName extends NamePath<TValues>>(
    path: TName,
    action: SetValueAction<TValues, TName>
  ): void {
    const previousValue = this.fieldStates.peekFieldInitialValue(path)

    const nextValue = resolveSetValueAction(action, previousValue)

    this.fieldStates.setFieldInitialValue(path, nextValue)
  }

  /**
   * 按叶子路径和已创建数组根批量更新初始值。
   *
   * @param action - 要合并写入的初始值对象或基于当前初始值计算下一值的 updater。
   */
  setInitialValues(action: SetValuesAction<TValues>): void {
    const values = resolveSetValuesAction(
      action,
      this.fieldStates.peekFieldInitialValue("" as NamePath<TValues>) as TValues
    )

    const paths = this.getBatchWritePaths(values)

    if (paths.length === 0) return

    batchUpdates(() => {
      for (const path of paths) {
        this.fieldStates.setFieldInitialValue(path, getByPath(values, path))
      }
    })
  }

  /**
   * 读取字段初始值，并为该路径建立独立于当前值的响应式依赖。
   *
   * @param path - 要读取的字段路径。
   * @returns 初始值；路径不存在时返回 `undefined`。
   */
  getInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return this.fieldStates.getFieldInitialValue(path)
  }

  /**
   * 读取全量初始值副本，或读取指定路径组成的初始值部分对象。
   *
   * @returns 初始值的独立副本或指定路径部分副本。
   */
  getInitialValues(): Partial<TValues>
  /**
   * 读取指定路径的初始值部分对象。
   *
   * @param paths - 要读取的字段路径列表。
   * @returns 指定路径组成的独立部分初始值。
   */
  getInitialValues<TName extends NamePath<TValues>>(paths: TName[]): Partial<TValues>
  // 根据是否提供路径列表分派全量或局部初始值读取。
  getInitialValues<TName extends NamePath<TValues>>(paths?: TName[]): Partial<TValues> {
    if (paths === undefined) {
      this.initialFormRevision.value

      return cloneDeep(
        this.fieldStates.peekFieldInitialValue("" as NamePath<TValues>)
      ) as Partial<TValues>
    }

    const result = {} as Partial<TValues>

    for (const path of paths) {
      setByPath(result, path, cloneDeep(this.fieldStates.peekFieldInitialValue(path)))
    }

    return result
  }

  /**
   * 设置单个字段的 touched 状态。
   *
   * @param path - 要更新的字段路径。
   * @param touched - 是否标记为 touched。
   */
  setFieldTouched<TName extends NamePath<TValues>>(path: TName, touched: boolean): void {
    batchUpdates(() => {
      this.fieldStates.setFieldTouched(path, touched)
    })
  }

  /**
   * 在同一个响应式批次中设置多个字段的 touched 状态。
   *
   * @param paths - 要更新的字段路径列表。
   * @param touched - 目标状态，默认为 `true`。
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
   * 读取单个字段的 touched 状态，并在首次读取时创建路径状态。
   *
   * @param path - 要检查的字段路径。
   * @returns 字段是否处于 touched 状态。
   */
  isFieldTouched<TName extends NamePath<TValues>>(path: TName): boolean {
    return this.fieldStates.isFieldTouched(path)
  }

  /**
   * 判断是否存在未 touched 字段，或判断指定字段是否全部 touched。
   *
   * @returns 无参数时表示存在未 touched 字段；传入路径时表示所有路径均 touched。
   */
  isFieldsTouched(): boolean
  /**
   * 判断指定字段是否全部 touched。
   *
   * @param paths - 要检查的字段路径列表。
   * @returns 所有指定路径均 touched 时返回 `true`。
   */
  isFieldsTouched<TName extends NamePath<TValues>>(paths: TName[]): boolean
  // 根据是否提供路径列表分派 touched 状态判断。
  isFieldsTouched<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    if (paths !== undefined) {
      return paths.every((path) => this.fieldStates.isFieldTouched(path))
    }

    return this.fieldStates.getFieldStates().some((i) => !i.touched.value)
  }

  /**
   * 返回当前已显式标记为 touched 的路径。
   *
   * @returns 按路径状态创建顺序返回 touched 字段路径。
   */
  getTouchedFields(): NamePath<TValues>[] {
    return this.fieldStates
      .getFieldStates()
      .filter((i) => i.touched.value)
      .map((i) => i.path)
  }

  /**
   * 设置单个字段的 pending 状态和提示消息。
   *
   * @param path - 要更新的字段路径。
   * @param pending - 是否标记为 pending。
   * @param message - pending 时显示的单条消息或消息列表。
   */
  setFieldPending<TName extends NamePath<TValues>>(
    path: TName,
    pending: boolean,
    message?: string | string[]
  ): void {
    batchUpdates(() => {
      this.fieldStates.setFieldPending(path, pending, message)
    })
  }

  /**
   * 在同一个响应式批次中设置多个字段的 pending 状态和消息。
   *
   * @param paths - 要更新的字段路径列表。
   * @param pending - 目标状态，默认为 `true`。
   * @param message - pending 时使用的单条消息或消息列表。
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
   * 读取单个字段的 pending 状态。
   *
   * @param path - 要检查的字段路径。
   * @returns 字段是否处于 pending 状态。
   */
  isFieldPending<TName extends NamePath<TValues>>(path: TName): boolean {
    return this.fieldStates.isFieldPending(path)
  }

  /**
   * 判断是否存在未 pending 字段，或判断指定字段是否全部 pending。
   *
   * @returns 无参数时表示存在未 pending 字段；传入路径时表示所有路径均 pending。
   */
  isFieldsPending(): boolean
  /**
   * 判断指定字段是否全部 pending。
   *
   * @param paths - 要检查的字段路径列表。
   * @returns 所有指定路径均 pending 时返回 `true`。
   */
  isFieldsPending<TName extends NamePath<TValues>>(paths: TName[]): boolean
  // 根据是否提供路径列表分派 pending 状态判断。
  isFieldsPending<TName extends NamePath<TValues>>(paths?: TName[]): boolean {
    if (paths !== undefined) {
      return paths.every((path) => this.fieldStates.isFieldPending(path))
    }

    return this.fieldStates.getFieldStates().some((i) => !i.pending.value)
  }

  /**
   * 返回当前处于 pending 的字段及其消息副本。
   *
   * @returns pending 字段信息列表。
   */
  getPendingFields(): StorePending<TValues, NamePath<TValues>>[] {
    return this.fieldStates
      .getFieldStates()
      .filter((i) => i.pending.value)
      .map((i) => ({
        field: i.path,
        message: i.pendingMessage.value,
      }))
  }

  /**
   * 覆盖单个字段保存的全部错误问题。
   */
  setFieldErrors(path: NamePath<TValues>, errors: readonly ValidationRuleIssue[]): void {
    this.fieldStates.setFieldErrors(path, errors)
  }

  /**
   * 在同一响应式批次中覆盖多个字段的全部错误问题。
   */
  setFieldsErrors(fields: readonly StoreFieldError<TValues>[]): void {
    batchUpdates(() => {
      for (const field of fields) {
        this.fieldStates.setFieldErrors(field.field, field.errors)
      }
    })
  }

  /**
   * 读取单个字段的错误问题，并建立字段级响应式依赖。
   */
  getFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[] {
    return this.fieldStates.getFieldErrors(path)
  }

  /**
   * 读取多个字段的错误问题；省略路径时返回全部存在错误的已注册字段。
   */
  getFieldsErrors(paths?: readonly NamePath<TValues>[]): StoreFieldError<TValues>[] {
    if (paths === undefined) {
      return this.fieldStates
        .getFieldStates()
        .filter((i) => i.errors.value.length)
        .map((i) => ({
          field: i.path,
          errors: [...i.errors.value],
        }))
    }

    return paths.map((field) => ({
      field,
      errors: [...this.fieldStates.getFieldErrors(field)],
    }))
  }

  /**
   * 无依赖读取单个字段的错误问题。
   */
  peekFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[] {
    return this.fieldStates.peekFieldErrors(path)
  }

  /**
   * 无依赖读取多个字段的错误问题；省略路径时返回全部存在错误的已注册字段。
   */
  peekFieldsErrors(paths?: readonly NamePath<TValues>[]): StoreFieldError<TValues>[] {
    if (paths === undefined) {
      return this.fieldStates
        .getFieldStates()
        .filter((i) => i.errors.peek().length)
        .map((i) => ({
          field: i.path,
          errors: [...i.errors.peek()],
        }))
    }

    return paths.map((field) => ({
      field,
      errors: [...this.fieldStates.peekFieldErrors(field)],
    }))
  }

  /**
   * 清除单个字段保存的全部错误问题。
   */
  clearFieldErrors(path: NamePath<TValues>): void {
    this.fieldStates.clearFieldErrors(path)
  }

  /**
   * 清除多个字段的错误问题；省略路径时清除全部已注册字段。
   */
  clearFieldsErrors(paths?: readonly NamePath<TValues>[]): void {
    if (paths === undefined) {
      this.fieldStates.clearAllErrors()

      return
    }

    batchUpdates(() => {
      for (const path of paths) {
        this.fieldStates.clearFieldErrors(path)
      }
    })
  }

  /**
   * 清除全部已注册字段保存的错误问题。
   */
  clearAllErrors(): void {
    this.fieldStates.clearAllErrors()
  }

  /**
   * 将单个路径恢复为初始值，并清理该路径及其后代的交互状态。
   *
   * 已注册数组根会同时重建全部行 key；普通父路径会同步重建其下的数组结构。
   *
   * @param path - 要重置的字段路径。
   */
  resetField<TName extends NamePath<TValues>>(path: TName): void {
    batchUpdates(() => {
      const arrayState = this.arrays.get(createFieldKey(path))

      if (arrayState) {
        this.resetArrayRoot(arrayState)

        return
      }

      const previousArrayLengths = this.getNestedArrayLengths(path)

      this.fieldStates.setFieldValue(path, this.fieldStates.peekFieldInitialValue(path))
      this.fieldStates.clearFieldTransientState(path)
      this.rebuildNestedArrayKeys(path, previousArrayLengths)
    })
  }

  /**
   * 在同一个响应式批次中重置多个字段。
   *
   * @param paths - 要重置的字段路径列表。
   */
  resetFields<TName extends NamePath<TValues>>(paths: TName[]): void {
    batchUpdates(() => {
      for (const path of paths) {
        this.resetField(path)
      }
    })
  }

  /**
   * 重置整份 Store，并可选地把传入值替换为新的初始值基线。
   *
   * 重置会清理所有路径的 touched/pending 状态，并为已注册数组重建行 key。
   * 传入的 `values` 被视为完整基线，不存在于其中的旧路径会从当前值中移除。
   *
   * @param values - 可选的新完整初始值；省略时恢复现有初始值。
   */
  reset(values?: Partial<TValues>): void {
    const nextInitialValues =
      values === undefined
        ? (cloneDeep(
            this.fieldStates.peekFieldInitialValue("" as NamePath<TValues>)
          ) as Partial<TValues>)
        : cloneDeep(values)

    const nextValues = cloneDeep(nextInitialValues) as TValues

    batchUpdates(() => {
      const previousArrayLengths = new Map<FieldKey, number>()

      for (const arrayState of this.arrays.values()) {
        previousArrayLengths.set(
          createFieldKey(arrayState.path),
          this.getArrayLength(arrayState.path)
        )
      }

      if (values !== undefined) {
        this.fieldStates.setFieldInitialValue("" as NamePath<TValues>, nextInitialValues)
      }

      this.fieldStates.setFieldValue("" as NamePath<TValues>, nextValues)

      this.fieldStates.clearFieldTransientState("" as NamePath<TValues>)

      for (const arrayState of this.arrays.values()) {
        const previousLength =
          previousArrayLengths.get(createFieldKey(arrayState.path)) ?? 0

        const nextLength = this.getArrayLength(arrayState.path)

        const change: FieldArrayChange = {
          previousLength,
          nextLength,
          ranges: this.createRootChangeRange(previousLength, nextLength),
          resetKeys: true,
        }

        arrayState.keys.value = this.createArrayKeys(arrayState, nextLength)
        this.fieldStates.invalidateFieldArrayErrors(arrayState.path, change)
        arrayState.change.value = change
      }

      this.snapshotRevision = -1
    })
  }

  /**
   * 按数组结构变化范围清理字段错误。
   */
  invalidateFieldArrayErrors(path: NamePath<TValues>, change: FieldArrayChange): void {
    this.fieldStates.invalidateFieldArrayErrors(path, change)
  }

  // 清理值树、路径状态、数组结构和快照缓存，使 Store 回到空状态。
  destroy(): void {
    this.fieldStates.destroy()

    this.arrays.clear()
    this.snapshotCache = undefined
    this.snapshotRevision = -1
  }

  /**
   * 将多个路径读取结果组装为独立的部分值对象。
   *
   * @param paths - 要读取的路径列表。
   * @param track - 是否通过响应式读取建立路径依赖。
   * @returns 由指定路径组成的部分值对象。
   */
  private buildPathValues(
    paths: readonly NamePath<TValues>[],
    track: boolean
  ): Partial<TValues> {
    const result = {} as Partial<TValues>

    for (const path of paths) {
      const value = track ? this.getFieldValue(path) : this.getFieldSnapshot(path)

      setByPath(result, path, track ? cloneDeep(value) : value)
    }

    return result
  }

  /**
   * 收集批量写入路径，并把已创建数组的任意后代路径折叠为数组根。
   *
   * 空数组不会产生叶子路径，因此额外读取已创建数组根以保留替换语义。
   *
   * @param values - 待写入的部分值对象。
   * @returns 去重后的字段或 FieldArray 根路径列表。
   */
  private getBatchWritePaths(values: Partial<TValues>): NamePath<TValues>[] {
    const paths = new Map<FieldKey, NamePath<TValues>>()

    for (const path of collectObjectPathsByLeaf<TValues>(values)) {
      const arrayState = this.getArrayStateForPath(path)

      const targetPath = arrayState?.path ?? path

      paths.set(createFieldKey(targetPath), targetPath)
    }

    for (const state of this.arrays.values()) {
      if (getByPath(values, state.path) !== undefined) {
        paths.set(createFieldKey(state.path), state.path)
      }
    }

    return [...paths.values()]
  }

  /**
   * 查找包含指定路径的已创建 FieldArray 根。
   *
   * @param path - 待判断的字段路径。
   * @returns 包含该路径的数组状态；不在任一数组根下时返回 `undefined`。
   */
  private getArrayStateForPath(path: NamePath<TValues>): ArrayState<TValues> | undefined {
    for (const state of this.arrays.values()) {
      if (
        createFieldKey(state.path) === createFieldKey(path) ||
        isDescendantFieldPath(path, state.path)
      ) {
        return state
      }
    }

    return undefined
  }

  /**
   * 获取或创建数组状态，并拒绝数组路径之间的父子嵌套。
   *
   * 普通字段注册不参与此冲突判断，因此普通字段与数组路径可以共存。
   *
   * @param path - 要创建状态的动态数组路径。
   * @returns 与数组路径绑定的数组状态。
   * @throws 当数组路径与已有数组路径互为父子时抛出错误。
   */
  private ensureArrayState(path: NamePath<TValues>): ArrayState<TValues> {
    const key = createFieldKey(path)

    const existing = this.arrays.get(key)

    if (existing) return existing

    for (const state of this.arrays.values()) {
      if (areOverlappingFieldPaths(state.path, path)) {
        throw new Error(
          `[schemx] Nested FieldArray fields are not supported: "${normalizeNamePath(path)}".`
        )
      }
    }

    const state: ArrayState<TValues> = {
      path,
      keys: createSignal([]),
      change: createSignal<FieldArrayChange | undefined>(undefined),
      nextKey: 0,
    }

    state.keys.value = this.createArrayKeys(state, this.getArrayLength(path))
    this.arrays.set(key, state)
    this.fieldStates.registerFieldPath(path)

    return state
  }

  /**
   * 获取已经注册的数组状态。
   *
   * @param path - 要读取状态的数组路径。
   * @returns 已注册的数组状态。
   * @throws 当数组路径尚未注册时抛出错误。
   */
  private getArrayState(path: NamePath<TValues>): ArrayState<TValues> {
    const state = this.arrays.get(createFieldKey(path))

    if (!state) {
      throw new Error(
        `[schemx] Array structure "${normalizeNamePath(path)}" is not registered.`
      )
    }

    return state
  }

  /**
   * 为数组状态生成不会复用的行 key。
   *
   * @param state - 要递增 key 序号的数组状态。
   * @param count - 要生成的 key 数量。
   * @returns 新生成的行 key 列表。
   * @throws 当数量不是非负整数时抛出 `RangeError`。
   */
  private createArrayKeys(state: ArrayState<TValues>, count: number): readonly string[] {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(
        `[schemx] FieldArray key count must be a non-negative integer.`
      )
    }

    const keys: string[] = []

    for (let index = 0; index < count; index += 1) {
      state.nextKey += 1
      keys.push(`fa_${state.nextKey}`)
    }

    return keys
  }

  /**
   * 按数组项引用协调数组根的行 key，并提交结构变更。
   */
  private updateArrayRoot(state: ArrayState<TValues>, value: unknown): void {
    const previousValue = this.fieldStates.peekFieldValue(state.path)

    if (Object.is(previousValue, value)) {
      return
    }

    const previousItems = Array.isArray(previousValue) ? previousValue : []

    const nextItems = Array.isArray(value) ? value : []

    const previousKeys = [...state.keys.peek()]

    if (previousKeys.length !== previousItems.length) {
      throw new Error(
        `[schemx] Array structure "${normalizeNamePath(state.path)}" is inconsistent.`
      )
    }

    const nextKeys = this.reconcileArrayKeys(
      state,
      previousItems,
      nextItems,
      previousKeys
    )

    const change: FieldArrayChange = {
      previousLength: previousItems.length,
      nextLength: nextItems.length,
      ranges: this.createKeyChangeRanges(previousKeys, nextKeys),
    }

    const keysChanged = !this.areKeysEqual(previousKeys, nextKeys)

    if (keysChanged) {
      state.keys.value = nextKeys
    }

    this.fieldStates.setFieldArrayValue(state.path, value, change)

    if (keysChanged) {
      state.change.value = change
    }
  }

  /**
   * 重置数组根并强制为每一行重新分配 key。
   */
  private resetArrayRoot(state: ArrayState<TValues>): void {
    const previousLength = this.getArrayLength(state.path)

    const value = this.fieldStates.peekFieldInitialValue(state.path)

    const nextLength = Array.isArray(value) ? value.length : 0

    const change: FieldArrayChange = {
      previousLength,
      nextLength,
      ranges: this.createRootChangeRange(previousLength, nextLength),
      resetKeys: true,
    }

    state.keys.value = this.createArrayKeys(state, nextLength)
    this.fieldStates.setFieldValue(state.path, value)
    this.fieldStates.clearFieldTransientState(state.path)
    this.fieldStates.invalidateFieldArrayErrors(state.path, change)
    state.change.value = change
  }

  /**
   * 删除数组根值并清空全部行 key、临时状态和过期错误。
   */
  private removeArrayRoot(state: ArrayState<TValues>): void {
    const previousLength = this.getArrayLength(state.path)

    const change: FieldArrayChange = {
      previousLength,
      nextLength: 0,
      ranges: this.createRootChangeRange(previousLength, 0),
      resetKeys: true,
    }

    this.fieldStates.removeFieldValue(state.path)
    this.fieldStates.clearFieldTransientState(state.path)
    this.fieldStates.clearFieldErrors(state.path)
    this.fieldStates.invalidateFieldArrayErrors(state.path, change)
    state.keys.value = []
    state.change.value = change
  }

  /**
   * 为新数组按旧数组项引用/原始值队列复用行 key。
   */
  private reconcileArrayKeys(
    state: ArrayState<TValues>,
    previousItems: readonly unknown[],
    nextItems: readonly unknown[],
    previousKeys: readonly string[]
  ): string[] {
    const oldIndexQueues = new Map<unknown, number[]>()

    for (let index = 0; index < previousItems.length; index += 1) {
      const item = previousItems[index]

      const queue = oldIndexQueues.get(item)

      if (queue) {
        queue.push(index)
      } else {
        oldIndexQueues.set(item, [index])
      }
    }

    const nextKeys: string[] = []

    for (const item of nextItems) {
      const queue = oldIndexQueues.get(item)

      const previousIndex = queue?.shift()

      if (previousIndex !== undefined) {
        const key = previousKeys[previousIndex]

        if (key === undefined) {
          throw new Error(
            `[schemx] Array structure "${normalizeNamePath(state.path)}" is inconsistent.`
          )
        }

        nextKeys.push(key)
      } else {
        nextKeys.push(...this.createArrayKeys(state, 1))
      }
    }

    return nextKeys
  }

  /**
   * 根据新旧 key 的索引差异生成并合并影响范围。
   */
  private createKeyChangeRanges(
    previousKeys: readonly string[],
    nextKeys: readonly string[]
  ): FieldArrayChange["ranges"] {
    const ranges: { start: number; end: number }[] = []

    let rangeStart: number | undefined

    const length = Math.max(previousKeys.length, nextKeys.length)

    for (let index = 0; index < length; index += 1) {
      const changed = previousKeys[index] !== nextKeys[index]

      if (changed && rangeStart === undefined) {
        rangeStart = index
      }

      if (!changed && rangeStart !== undefined) {
        ranges.push({ start: rangeStart, end: index - 1 })
        rangeStart = undefined
      }
    }

    if (rangeStart !== undefined) {
      ranges.push({ start: rangeStart, end: length - 1 })
    }

    return ranges
  }

  /**
   * 按顺序比较两组行 key。
   */
  private areKeysEqual(
    previousKeys: readonly string[],
    nextKeys: readonly string[]
  ): boolean {
    return (
      previousKeys.length === nextKeys.length &&
      previousKeys.every((key, index) => key === nextKeys[index])
    )
  }

  /**
   * 读取数组根的当前长度；nullish 值按空数组处理。
   *
   * @param path - 数组根路径。
   * @returns 当前数组长度。
   */
  private getArrayLength(path: NamePath<TValues>): number {
    const value = this.fieldStates.peekFieldValue(path)

    return Array.isArray(value) ? value.length : 0
  }

  /**
   * 根据新旧数组长度创建覆盖差异范围的根替换描述。
   *
   * @param previousLength - 替换前数组长度。
   * @param nextLength - 替换后数组长度。
   * @returns 覆盖旧值和新值的单个范围，空数组时返回空列表。
   */
  private createRootChangeRange(
    previousLength: number,
    nextLength: number
  ): FieldArrayChange["ranges"] {
    const end = Math.max(previousLength, nextLength) - 1

    return end < 0 ? [] : [{ start: 0, end }]
  }

  /**
   * 获取指定父路径下已注册数组的当前长度。
   */
  private getNestedArrayLengths(path: NamePath<TValues>): Map<FieldKey, number> {
    const lengths = new Map<FieldKey, number>()

    for (const state of this.arrays.values()) {
      if (isDescendantFieldPath(state.path, path)) {
        lengths.set(createFieldKey(state.path), this.getArrayLength(state.path))
      }
    }

    return lengths
  }

  /**
   * 重置或删除父路径时，为其下已注册数组重建行 key 并发布结构变化。
   */
  private rebuildNestedArrayKeys(
    path: NamePath<TValues>,
    previousLengths: ReadonlyMap<FieldKey, number>
  ): void {
    for (const state of this.arrays.values()) {
      if (!isDescendantFieldPath(state.path, path)) continue

      const previousLength = previousLengths.get(createFieldKey(state.path)) ?? 0

      const nextLength = this.getArrayLength(state.path)

      const change: FieldArrayChange = {
        previousLength,
        nextLength,
        ranges: this.createRootChangeRange(previousLength, nextLength),
        resetKeys: true,
      }

      state.keys.value = this.createArrayKeys(state, nextLength)
      this.fieldStates.clearFieldTransientState(state.path)
      this.fieldStates.clearFieldErrors(state.path)
      this.fieldStates.invalidateFieldArrayErrors(state.path, change)
      state.change.value = change
    }
  }
}

/**
 * 创建表单 Store。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 可选的初始值配置。
 * @returns 新建的 Store 实例。
 *
 * @example
 * ```ts
 * const store = createStore({ initialValues: { name: "Ada" } })
 * store.setFieldValue("name", "Grace")
 * ```
 */
export function createStore<TValues extends Values = Values>(
  options: StoreOptions<TValues> = {}
): Store<TValues> {
  return new StoreImpl<TValues>(options)
}
