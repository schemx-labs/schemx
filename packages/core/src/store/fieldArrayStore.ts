/**
 * 管理 FieldArray 的结构 key、数组根提交和结构变更通知。
 */
import { isEqual } from "es-toolkit"

import { createSignal, type Signal } from "../reactivity"
import { createFieldKey, getByPath, normalizeNamePath } from "../utils"

import { FieldStateStore } from "./fieldStateStore"
import { OwnedSubtreeRegistry } from "./ownedSubtree"

import type {
  FieldArrayChange,
  FieldArrayHandle,
  FieldArrayItemValue,
  FieldArrayPath,
} from "../fieldArray"
import type { FieldValue, NamePath, Values } from "../types"

/**
 * 保存单个数组 owner 的结构状态和监听器。
 */
interface FieldArrayState<TValues extends Values> {
  /**
   * 数组根路径。
   */
  readonly path: NamePath<TValues>
  /**
   * 用于关联 owner 注册表的稳定 key。
   */
  readonly key: string
  /**
   * 只保存行 key 的结构 Signal。
   */
  readonly structure: Signal<readonly string[]>
  /**
   * 监听数组结构提交的回调集合。
   */
  readonly listeners: Set<(change: FieldArrayChange) => void>
  /**
   * 下一行 key 的递增序号。
   */
  nextKey: number
}

/**
 * 描述 FieldArrayStore 的组合依赖。
 */
export interface FieldArrayStoreOptions<TValues extends Values> {
  /**
   * 负责路径 owner 注册、重叠校验和数组 owner 吸收。
   */
  readonly registry: OwnedSubtreeRegistry<TValues>
  /**
   * 负责数组值对应的字段 Signal 和交互状态。
   */
  readonly fieldState: FieldStateStore<TValues>
  /**
   * 读取当前完整值快照，用于首次注册数组状态。
   */
  readonly readSnapshot: () => TValues
  /**
   * 标记数组根发生值或结构变化。
   */
  readonly markValueChanged: (path: NamePath<TValues>) => void
}

/**
 * 管理 FieldArray 结构状态和数组根提交。
 */
class FieldArrayStoreImpl<TValues extends Values> {
  /**
   * 按数组 owner key 保存独立结构状态。
   */
  private readonly states = new Map<string, FieldArrayState<TValues>>()
  /**
   * 共享的 owner 注册表。
   */
  private readonly registry: OwnedSubtreeRegistry<TValues>
  /**
   * 共享的字段状态存储。
   */
  private readonly fieldState: FieldStateStore<TValues>
  /**
   * 用于首次注册时读取数组当前值的回调。
   */
  private readonly readSnapshot: () => TValues
  /**
   * 用于通知快照和字段状态数组根发生变化的回调。
   */
  private readonly markValueChanged: (path: NamePath<TValues>) => void

  /**
   * 保存组合依赖，不在构造阶段注册具体数组路径。
   *
   * @param options FieldArrayStore 的组合依赖。
   */
  constructor(options: FieldArrayStoreOptions<TValues>) {
    this.registry = options.registry
    this.fieldState = options.fieldState
    this.readSnapshot = options.readSnapshot
    this.markValueChanged = options.markValueChanged
  }

  /**
   * 注册数组根并返回稳定 Handle。
   *
   * @param path 要绑定的动态数组路径。
   * @returns 可供 FieldArray 控制器使用的数组 Handle。
   */
  getFieldArrayHandle<TPath extends FieldArrayPath<TValues>>(
    path: TPath
  ): FieldArrayHandle<FieldArrayItemValue<FieldValue<TValues, TPath>>> {
    type TItem = FieldArrayItemValue<FieldValue<TValues, TPath>>

    /**
     * 确保数组 owner 和初始结构已注册。
     */
    const register = (): void => {
      this.registerFieldArrayState(path)
    }

    /**
     * 读取数组根当前值。
     */
    const getValue = (): readonly TItem[] | null | undefined => {
      return this.getFieldArrayValue(path) as readonly TItem[] | null | undefined
    }

    /**
     * 读取当前稳定行 key。
     */
    const getStructure = (): readonly string[] => {
      return this.getFieldArrayStructure(path)
    }

    /**
     * 创建指定数量的新行 key。
     *
     * @param count 要创建的 key 数量。
     */
    const createKeys = (count: number): readonly string[] => {
      return this.createFieldArrayKeys(this.getFieldArrayState(path), count)
    }

    /**
     * 提交数组值、结构 key 和结构变更范围。
     *
     * @param value 提交后的数组值。
     * @param keys 与数组值一一对应的稳定行 key。
     * @param change 本次结构变化及其受影响范围。
     */
    const commit = (
      value: readonly TItem[],
      keys: readonly string[],
      change: FieldArrayChange
    ): void => {
      this.commitFieldArrayValue(path, value, keys, change)
    }

    /**
     * 订阅数组结构变化。
     *
     * @param listener 接收结构变化描述的回调。
     * @returns 取消本次订阅的函数。
     */
    const subscribe = (listener: (change: FieldArrayChange) => void): (() => void) => {
      const state = this.getFieldArrayState(path)

      state.listeners.add(listener)

      return () => {
        state.listeners.delete(listener)
      }
    }

    return {
      register,
      getValue,
      getStructure,
      createKeys,
      commit,
      subscribe,
    }
  }

  /**
   * 以 set 或 reset 语义替换数组根，并重建全部行 key。
   *
   * @param path 要替换的数组根路径。
   * @param value 新数组值；`null` 或 `undefined` 表示空数组状态。
   * @param options 指定本次替换是普通 set 还是 reset。
   * @throws 当 value 不是数组或 nullish 值时抛出 `TypeError`。
   */
  replaceRoot<TPath extends NamePath<TValues>>(
    path: TPath,
    value: unknown,
    options: { readonly mode: "set" | "reset" }
  ): void {
    this.assertFieldArrayValue(path, value)

    const state = this.getFieldArrayState(path)

    const previousValue = this.getFieldArrayValue(path)

    const nextValue = value as readonly unknown[] | null | undefined

    const previousLength = previousValue == null ? 0 : previousValue.length

    const nextLength = nextValue == null ? 0 : nextValue.length

    if (options.mode === "set" && isEqual(previousValue, nextValue)) return

    const change: FieldArrayChange = {
      previousLength,
      nextLength,
      ranges: this.createRootChangeRange(previousLength, nextLength),
      resetKeys: true,
    }

    const keys = this.createFieldArrayKeys(state, nextLength)

    this.commitFieldArrayValue(path, nextValue, keys, change, true)
  }

  /**
   * 清理全部数组状态和订阅。
   */
  destroy(): void {
    for (const state of this.states.values()) {
      state.listeners.clear()
    }

    this.states.clear()
  }

  /**
   * 注册指定数组路径的 owner、Signal 和初始结构 key。
   *
   * @param path 要注册的数组根路径。
   */
  private registerFieldArrayState<TPath extends NamePath<TValues>>(path: TPath): void {
    const plan = this.registry.prepareFieldArrayRegistration(path)

    if (plan.action === "reuse") return

    const currentValues = this.readSnapshot()

    const snapshotValue = getByPath<TValues, TPath>(currentValues, path)

    const initialValue = this.fieldState.getInitialValue(path)

    const currentValue = snapshotValue === undefined ? initialValue : snapshotValue

    this.assertFieldArrayValue(path, currentValue)
    this.assertFieldArrayValue(path, initialValue)

    const currentLength = Array.isArray(currentValue) ? currentValue.length : 0

    const state: FieldArrayState<TValues> = {
      path,
      key: plan.key,
      structure: createSignal([]),
      listeners: new Set(),
      nextKey: 0,
    }

    state.structure.value = this.createFieldArrayKeys(state, currentLength)
    this.registry.commitFieldArrayRegistration(plan)
    this.states.set(plan.key, state)
    this.fieldState.adoptOwnerRoot(path, currentValue, initialValue)
    this.markValueChanged(path)
  }

  /**
   * 获取已注册数组路径的结构状态。
   *
   * @param path 要查找的数组根路径。
   * @returns 数组结构状态。
   * @throws 当数组路径尚未注册或状态已丢失时抛出错误。
   */
  private getFieldArrayState(path: NamePath<TValues>): FieldArrayState<TValues> {
    const owner = this.registry.get(path)

    const state = this.states.get(createFieldKey(path))

    if (!owner || owner.kind !== "fieldArray" || !state) {
      throw new Error(
        `[schemx] FieldArray field "${normalizeNamePath(path)}" is not registered.`
      )
    }

    return state
  }

  /**
   * 读取数组根当前值。
   *
   * @param path 要读取的数组根路径。
   * @returns 数组值或 nullish 空状态。
   */
  private getFieldArrayValue<TPath extends NamePath<TValues>>(
    path: TPath
  ): readonly unknown[] | null | undefined {
    return this.fieldState.getArrayValue(path)
  }

  /**
   * 读取数组根的稳定行 key。
   *
   * @param path 要读取的数组根路径。
   * @returns 当前行 key 的只读列表。
   */
  private getFieldArrayStructure<TPath extends NamePath<TValues>>(
    path: TPath
  ): readonly string[] {
    return this.getFieldArrayState(path).structure.value
  }

  /**
   * 校验数组根值满足 FieldArray 的 nullish-or-array 约束。
   *
   * @param path 待校验值对应的数组根路径。
   * @param value 待校验的数组根值。
   * @throws 当 value 不是数组、`null` 或 `undefined` 时抛出 `TypeError`。
   */
  private assertFieldArrayValue(path: NamePath<TValues>, value: unknown): void {
    if (value == null || Array.isArray(value)) return

    throw new TypeError(
      `[schemx] FieldArray field "${normalizeNamePath(path)}" must contain an array.`
    )
  }

  /**
   * 为数组状态生成单调递增且不会复用的行 key。
   *
   * @param state 要递增 key 序号的数组状态。
   * @param count 要生成的 key 数量。
   * @returns 新生成的行 key 列表。
   * @throws 当 count 不是非负整数时抛出 `RangeError`。
   */
  private createFieldArrayKeys(
    state: FieldArrayState<TValues>,
    count: number
  ): readonly string[] {
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
   * 原子提交数组值、结构 key，并通知字段状态和结构监听器。
   *
   * @param path 要提交的数组根路径。
   * @param value 提交后的数组值。
   * @param keys 与数组值对应的稳定行 key。
   * @param change 本次结构变更描述。
   * @param force 是否即使值未变化也强制提交。
   * @throws 当 key 数量与数组长度不一致时抛出错误。
   */
  private commitFieldArrayValue(
    path: NamePath<TValues>,
    value: readonly unknown[] | null | undefined,
    keys: readonly string[],
    change: FieldArrayChange,
    force = false
  ): void {
    const state = this.getFieldArrayState(path)

    const currentValue = this.getFieldArrayValue(path)

    const nextValue = value == null ? value : [...value]

    const nextLength = nextValue == null ? 0 : nextValue.length

    this.assertFieldArrayValue(path, nextValue)

    if (keys.length !== nextLength) {
      throw new Error(
        `[schemx] FieldArray field "${normalizeNamePath(path)}" has inconsistent key state.`
      )
    }

    if (!force && isEqual(currentValue, nextValue)) return

    state.structure.value = [...keys]
    this.fieldState.setOwnerCurrentValue(path, nextValue)
    this.fieldState.clearArrayTransientState(path, change)
    this.markValueChanged(path)

    for (const listener of [...state.listeners]) {
      listener(change)
    }
  }

  /**
   * 根据替换前后的长度生成覆盖受影响行的范围。
   *
   * @param previousLength 替换前数组长度。
   * @param nextLength 替换后数组长度。
   * @returns 覆盖旧值和新值长度差异的范围列表。
   */
  private createRootChangeRange(
    previousLength: number,
    nextLength: number
  ): FieldArrayChange["ranges"] {
    const end = Math.max(previousLength, nextLength) - 1

    return end < 0 ? [] : [{ start: 0, end }]
  }
}

/**
 * 暴露 FieldArray 状态存储的内部能力，不暴露其构造方式。
 */
export type FieldArrayStore<TValues extends Values> = FieldArrayStoreImpl<TValues>

/**
 * 创建 FieldArray 状态存储。
 *
 * @typeParam TValues 表单值对象类型。
 * @param options FieldArrayStore 的组合依赖。
 * @returns 可供 Store 组合根使用的数组状态存储。
 * @example
 * ```ts
 * const fieldArrayStore = createFieldArrayStore<FormValues>(options)
 * ```
 */
export function createFieldArrayStore<TValues extends Values>(
  options: FieldArrayStoreOptions<TValues>
): FieldArrayStore<TValues> {
  return new FieldArrayStoreImpl<TValues>(options)
}
