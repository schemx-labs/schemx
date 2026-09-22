/**
 * Store 专用的字段状态和值树容器。
 *
 * FieldSignalMap 持有唯一的当前值和初始值，并统一封装字段值读写、路径依赖
 * 与 touched/pending/errors 状态。Store 只保留全表 revision、快照缓存、注册边界
 * 和 FieldArray 结构算法。
 *
 * @module core/store/fieldSignalMap
 */

import { cloneDeep, isEqual } from "es-toolkit"

import { batchUpdates } from "../reactivity/batch"
import { createSignal } from "../reactivity/signal"
import {
  areSameOrOverlappingFieldPaths,
  createFieldKey,
  deleteInWithStructuralSharing,
  getByPath,
  isDescendantFieldPath,
  isFieldArrayDescendantAffected,
  isFieldArrayDescendantOutOfRange,
  setInWithStructuralSharing,
  toNamePathSegments,
  toStructuralPathSegments,
} from "../utils/path"

import type { Signal } from "../reactivity/signal"
import type { FieldArrayChange, FieldValue, NamePath, Values } from "../types"
import type { FieldKey } from "../utils/path"
import type { ValidationRuleIssue } from "../validator/types"

/**
 * FieldSignalMap 的构造配置。
 *
 * 值树、字段交互状态和注册路径均由 Map 唯一持有；回调仅用于把值变化同步给
 * Store 的全表 revision 和快照缓存，不会向外暴露内部 Signal。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldSignalMapOptions<TValues extends Values> {
  /**
   * 创建容器时深拷贝的初始值基线。
   */
  readonly initialValues?: TValues
  /**
   * 当前值实际变化后通知 Store 更新全表 revision 和快照缓存。
   */
  readonly onValueChanged?: () => void
  /**
   * 初始值实际变化后通知 Store 更新初始值 revision。
   */
  readonly onInitialValueChanged?: () => void
}

// 保存单个字段路径的响应式状态；不重复保存字段值。
interface FieldState<TValues extends Values> {
  // 首次创建状态时使用的路径写法。
  readonly path: NamePath<TValues>
  // 当前值变更版本。
  readonly valueRevision: Signal<number>
  // 初始值变更版本。
  readonly initialRevision: Signal<number>
  // 字段是否被标记为 touched。
  readonly touched: Signal<boolean>
  // 字段是否处于 pending。
  readonly pending: Signal<boolean>
  // pending 对应的消息列表。
  readonly pendingMessage: Signal<readonly string[]>
  // 字段按来源独立响应的错误问题。
  readonly errors: Signal<readonly ValidationRuleIssue[]>
}

/**
 * Store 使用的字段路径和值状态操作接口。
 *
 * 接口以单路径读写为主，并提供已注册字段状态的批量遍历能力。
 * Store 负责批量值写入边界和 FieldArray 结构算法。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldSignalMap<TValues extends Values = Values> {
  /**
   * 注册字段路径并物化对应状态，以支持后续批量操作和交互状态读取。
   *
   * @param path - 要注册的字段路径。
   */
  registerFieldPath(path: NamePath<TValues>): void
  /**
   * 反注册字段路径；不会删除值、初始值或已注册的字段状态。
   *
   * @param path - 要反注册的字段路径。
   */
  unregisterFieldPath(path: NamePath<TValues>): void
  /**
   * 写入单个字段的当前值，并通知目标路径及其重叠路径。
   *
   * @param path - 要写入的字段路径。
   * @param value - 要写入的字段值。
   * @returns 值实际发生变化时返回 `true`。
   */
  setFieldValue(path: NamePath<TValues>, value: unknown): boolean
  /**
   * 删除单个字段的当前值，并清理该路径的临时交互状态。
   *
   * @param path - 要删除的字段路径；空根路径表示清空全部当前值。
   * @returns 当前值实际发生变化时返回 `true`。
   */
  removeFieldValue(path: NamePath<TValues>): boolean
  /**
   * 读取当前值并建立指定路径的字段级依赖。
   *
   * @typeParam TName - 当前读取的字段路径类型。
   * @param path - 要读取的字段路径。
   * @returns 当前字段值；路径不存在时返回 `undefined`。
   */
  getFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined
  /**
   * 无依赖读取当前值。
   *
   * @typeParam TName - 当前读取的字段路径类型。
   * @param path - 要读取的字段路径。
   * @returns 当前字段值；不会创建路径依赖。
   */
  peekFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined
  /**
   * 读取指定字段的独立快照。
   *
   * @typeParam TName - 当前读取的字段路径类型。
   * @param path - 要读取的字段路径。
   * @returns 当前字段值的深拷贝；路径不存在时返回 `undefined`。
   */
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined

  /**
   * 写入单个字段的初始值，并通知对应的初始值依赖。
   *
   * @param path - 要写入的字段路径。
   * @param value - 要写入的初始值。
   * @returns 初始值实际发生变化时返回 `true`。
   */
  setFieldInitialValue(path: NamePath<TValues>, value: unknown): boolean
  /**
   * 读取初始值并建立指定路径的字段级依赖。
   *
   * @typeParam TName - 当前读取的字段路径类型。
   * @param path - 要读取的字段路径。
   * @returns 字段初始值；路径不存在时返回 `undefined`。
   */
  getFieldInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined
  /**
   * 无依赖读取初始值。
   *
   * @typeParam TName - 当前读取的字段路径类型。
   * @param path - 要读取的字段路径。
   * @returns 字段初始值；不会创建路径依赖。
   */
  peekFieldInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined
  /**
   * 提交单个 FieldArray 根值，并按变更范围处理字段依赖和 transient 状态。
   *
   * @param path - FieldArray 根路径。
   * @param value - 提交后的数组值。
   * @param change - 本次数组结构变化及受影响索引范围。
   * @returns 操作已完成；即使值相等但结构通知仍需发出时也返回 `true`。
   */
  setFieldArrayValue(
    path: NamePath<TValues>,
    value: unknown,
    change: FieldArrayChange
  ): boolean
  /**
   * 按数组结构变更范围清理过期错误。
   *
   * @param path - 发生结构变更的数组根路径。
   * @param change - 用于判断受影响索引范围的变更描述。
   */
  invalidateFieldArrayErrors(path: NamePath<TValues>, change: FieldArrayChange): void
  /**
   * 在数组值已由父路径写入后发布结构变化。
   */
  notifyFieldArrayChange(path: NamePath<TValues>, change: FieldArrayChange): void
  /**
   * 设置指定路径的 touched 状态。
   *
   * @param path - 要更新的字段路径。
   * @param touched - 是否标记为 touched。
   */
  setFieldTouched(path: NamePath<TValues>, touched: boolean): void
  /**
   * 读取指定路径的 touched 状态。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段是否处于 touched 状态。
   */
  isFieldTouched(path: NamePath<TValues>): boolean
  /**
   * 设置指定路径的 pending 状态和消息。
   *
   * @param path - 要更新的字段路径。
   * @param pending - 是否标记为 pending。
   * @param message - pending 时使用的单条消息或消息列表。
   */
  setFieldPending(
    path: NamePath<TValues>,
    pending: boolean,
    message?: string | string[]
  ): void
  /**
   * 读取指定路径的 pending 状态。
   *
   * @param path - 要读取的字段路径。
   * @returns 字段是否处于 pending。
   */
  isFieldPending(path: NamePath<TValues>): boolean
  /**
   * 无依赖读取指定路径的 pending 消息。
   *
   * @param path - 要读取的字段路径。
   * @returns pending 消息的独立副本。
   */
  getFieldPendingMessage(path: NamePath<TValues>): string[]
  /**
   * 覆盖指定字段的全部错误问题。
   *
   * @param path - 要写入的字段路径。
   * @param errors - 要保存的问题列表。
   */
  setFieldErrors(path: NamePath<TValues>, errors: readonly ValidationRuleIssue[]): void
  /** 清除 pending 提交流程产生的 external 错误。 */
  clearFieldPendingErrors(path: NamePath<TValues>): void
  /**
   * 读取指定路径保存的错误问题。
   *
   * @param path - 要读取的字段路径。
   * @returns 错误问题的独立列表；不会暴露内部存储引用。
   */
  getFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[]
  /**
   * 无依赖读取指定路径保存的错误问题。
   *
   * @param path - 要读取的字段路径。
   * @returns 错误问题的独立列表。
   */
  peekFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[]
  /**
   * 清除指定字段的全部错误来源。
   *
   * @param path - 要读取的字段路径。
   */
  clearFieldErrors(path: NamePath<TValues>): void
  /**
   * 清除所有已注册字段的错误来源。
   */
  clearAllErrors(): void
  /**
   * 获取多个或全部已注册字段的状态记录。
   *
   * @param paths - 可选的字段路径列表；省略时返回全部已注册字段。
   * @returns 按路径顺序排列的字段状态记录。
   */
  getFieldStates(paths?: readonly NamePath<TValues>[]): readonly FieldState<TValues>[]
  /**
   * 迭代多个或全部已注册字段的路径和状态记录。
   *
   * @param paths - 可选的字段路径列表；省略时迭代全部已注册字段。
   * @returns 字段路径与状态记录迭代器。
   */
  getFieldEntries(
    paths?: readonly NamePath<TValues>[]
  ): IterableIterator<[NamePath<TValues>, FieldState<TValues>]>
  /**
   * 迭代多个或全部已注册字段的状态记录。
   *
   * @param paths - 可选的字段路径列表；省略时迭代全部已注册字段。
   * @returns 字段状态记录迭代器。
   */
  getFieldValues(
    paths?: readonly NamePath<TValues>[]
  ): IterableIterator<FieldState<TValues>>
  /**
   * 迭代多个或全部已注册字段的路径。
   *
   * @param paths - 可选的字段路径列表；省略时迭代全部已注册字段。
   * @returns 字段路径迭代器。
   */
  getFieldKeys(paths?: readonly NamePath<TValues>[]): IterableIterator<NamePath<TValues>>

  /**
   * 清理指定路径及其后代的 touched、pending 和 pending 消息。
   *
   * @param path - 要清理的字段路径；空根路径表示清理全部已创建状态。
   */
  clearFieldTransientState(path: NamePath<TValues>): void
  /**
   * 销毁值树和所有路径状态；后续读取或写入会按需重新创建路径状态。
   */
  destroy(): void
}

/**
 * 将 pending 消息统一转换为独立的只读列表。
 *
 * @param message - 单条消息或消息列表；未提供时返回空列表。
 * @returns 规范化后的消息列表。
 */
function normalizePendingMessage(message?: string | string[]): readonly string[] {
  if (message === undefined) return []

  return Array.isArray(message) ? [...message] : [message]
}

/**
 * 按顺序比较两组 pending 消息。
 *
 * @param previous - 当前保存的消息列表。
 * @param next - 待比较的新消息列表。
 * @returns 两组消息长度、顺序和内容都相同时返回 `true`。
 */
function areMessagesEqual(previous: readonly string[], next: readonly string[]): boolean {
  return (
    previous.length === next.length &&
    previous.every((message, index) => message === next[index])
  )
}

// Store 专用字段路径和值状态容器实现。
class FieldSignalMapImpl<TValues extends Values> implements FieldSignalMap<TValues> {
  // 当前表单值的值。
  private values: TValues
  // reset 使用的初始值基线。
  private initialValues: Partial<TValues>
  // 当前值变更后通知 Store 的回调。
  private readonly onValueChanged: () => void
  // 初始值变更后通知 Store 的回调。
  private readonly onInitialValueChanged: () => void
  // 按规范化路径缓存惰性创建的字段状态。
  private readonly states = new Map<FieldKey, FieldState<TValues>>()
  // 字段状态集合变化后递增，供字段集合读取建立结构依赖。
  private readonly stateRevision = createSignal(0)
  // touched 或 pending 状态变化时递增的交互版本。
  private readonly interactionRevision = createSignal(0)
  // 字段错误变化时递增的错误版本。
  private readonly errorRevision = createSignal(0)

  /**
   * 创建字段状态容器，并深拷贝初始值以隔离调用方修改。
   *
   * @param options - 值树和 Store 同步回调配置。
   */
  constructor(options: FieldSignalMapOptions<TValues> = {}) {
    this.initialValues = cloneDeep(options.initialValues ?? {})
    this.values = cloneDeep(this.initialValues) as TValues
    this.onValueChanged = options.onValueChanged ?? (() => undefined)
    this.onInitialValueChanged = options.onInitialValueChanged ?? (() => undefined)
  }

  // 物化字段状态；字段注册不会复制或接管值树。
  registerFieldPath(path: NamePath<TValues>): void {
    this.ensureState(path)
  }

  // 保留已注册状态；Store 的反注册只影响上层注册边界。
  unregisterFieldPath(_path: NamePath<TValues>): void {}

  // 读取 revision 以建立字段级依赖，再从唯一值树读取字段值。
  getFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    this.ensureState(path).valueRevision.value

    return getByPath<TValues, TName>(this.values, path)
  }

  // 无依赖读取当前值，供快照和内部结构判断使用。
  peekFieldValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return getByPath<TValues, TName>(this.values, path)
  }

  // 仅在结构共享写入实际变化时通知相关字段依赖。
  setFieldValue(path: NamePath<TValues>, value: unknown): boolean {
    const changed = this.writeCurrentValue(path, value)

    if (changed) this.notifyValueChanged(path)

    return changed
  }

  /**
   * 删除当前值并清理指定路径的临时交互状态。
   */
  removeFieldValue(path: NamePath<TValues>): boolean {
    const segments = toStructuralPathSegments(path)

    const nextValues =
      segments.length === 0 ? {} : deleteInWithStructuralSharing(this.values, segments)

    const changed = !Object.is(nextValues, this.values)

    if (changed) {
      this.values = nextValues as TValues
      this.onValueChanged()
      this.notifyValueChanged(path)
    }

    const state = this.states.get(createFieldKey(path))

    if (state) {
      this.clearState(state)
    }

    return changed
  }

  // 返回当前值的深拷贝，避免调用方通过快照修改内部值树。
  getFieldSnapshot<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return cloneDeep(this.peekFieldValue(path))
  }

  // 读取 initialRevision 以建立独立于当前值的初始值依赖。
  getFieldInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    this.ensureState(path).initialRevision.value

    return getByPath<TValues, TName>(this.initialValues, path)
  }

  // 无依赖读取初始值，供 reset 和内部比较使用。
  peekFieldInitialValue<TName extends NamePath<TValues>>(
    path: TName
  ): FieldValue<TValues, TName> | undefined {
    return getByPath<TValues, TName>(this.initialValues, path)
  }

  // 仅在初始值实际变化时通知对应路径依赖。
  setFieldInitialValue(path: NamePath<TValues>, value: unknown): boolean {
    const changed = this.writeInitialValue(path, value)

    if (changed) this.notifyInitialChanged(path)

    return changed
  }

  // 数组根提交按引用写入，避免深度相等的克隆行被误判为无变化。
  setFieldArrayValue(
    path: NamePath<TValues>,
    value: unknown,
    change: FieldArrayChange
  ): boolean {
    const previousValue = getByPath<TValues>(this.values, path)

    if (Object.is(previousValue, value)) return false

    this.values = setInWithStructuralSharing(
      this.values,
      toStructuralPathSegments(path),
      value
    ) as TValues

    this.onValueChanged()

    this.clearArrayTransientState(path, change)
    this.invalidateFieldArrayErrors(path, change)
    this.notifyArrayValueChanged(path, change)

    return true
  }

  /**
   * 按数组变更范围清理数组根后代的过期错误。
   *
   * 越界字段清空全部错误；仍在范围内且受影响的字段仅保留 configuration 错误。
   *
   * @param arrayPath - 发生结构变更的数组根路径。
   * @param change - 用于判断受影响索引范围的变更描述。
   */
  invalidateFieldArrayErrors(
    arrayPath: NamePath<TValues>,
    change: FieldArrayChange
  ): void {
    let changed = false

    batchUpdates(() => {
      for (const state of this.states.values()) {
        const errors = state.errors

        const current = errors.peek()

        if (current.length === 0) continue

        let next = current

        if (createFieldKey(state.path) === createFieldKey(arrayPath)) {
          next =
            change.ranges.length > 0 || change.resetKeys === true
              ? current.filter((error) => error.type === "configuration")
              : current
        } else if (
          isFieldArrayDescendantOutOfRange(state.path, arrayPath, change.nextLength)
        ) {
          next = []
        } else if (isFieldArrayDescendantAffected(state.path, arrayPath, change)) {
          next = current.filter((error) => error.type === "configuration")
        } else {
          continue
        }

        if (next.length === current.length) continue

        errors.value = next
        changed = true
      }

      if (changed) this.errorRevision.value += 1
    })
  }

  // 只有 touched 状态真正变化时才递增交互版本。
  setFieldTouched(path: NamePath<TValues>, touched: boolean): void {
    const state = this.ensureState(path)

    if (state.touched.peek() === touched) return

    state.touched.value = touched
    this.interactionRevision.value += 1
  }

  // 读取 touched 状态，同时为字段状态建立响应式依赖。
  isFieldTouched(path: NamePath<TValues>): boolean {
    return this.ensureState(path).touched.value
  }

  // 统一保存 pending 标志和消息，关闭 pending 时同步清空消息。
  setFieldPending(
    path: NamePath<TValues>,
    pending: boolean,
    message?: string | string[]
  ): void {
    const state = this.ensureState(path)

    const nextMessage = pending ? normalizePendingMessage(message) : []

    const stateChanged =
      state.pending.peek() !== pending ||
      !areMessagesEqual(state.pendingMessage.peek(), nextMessage)

    if (!stateChanged) return

    state.pending.value = pending
    state.pendingMessage.value = nextMessage
    this.interactionRevision.value += 1
  }

  // 读取 pending 状态，同时为字段状态建立响应式依赖。
  isFieldPending(path: NamePath<TValues>): boolean {
    return this.ensureState(path).pending.value
  }

  // 返回 pending 消息副本，避免暴露内部数组。
  getFieldPendingMessage(path: NamePath<TValues>): string[] {
    return [...this.ensureState(path).pendingMessage.value]
  }

  // 替换字段的全部错误来源，并递增错误集合版本。
  setFieldErrors(path: NamePath<TValues>, errors: readonly ValidationRuleIssue[]): void {
    const state = this.ensureState(path).errors

    state.value = [...errors]

    this.errorRevision.value += 1
  }

  clearFieldPendingErrors(path: NamePath<TValues>): void {
    const state = this.ensureState(path).errors

    const current = state.peek()

    const next = current.filter((issue) => issue.code !== "pending")

    if (next.length === current.length) return

    state.value = next
    this.errorRevision.value += 1
  }

  // 读取错误并建立错误状态依赖；返回值始终是独立列表。
  getFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[] {
    return [...this.ensureState(path).errors.value]
  }

  // 无依赖读取错误，供内部清理和聚合使用。
  peekFieldErrors(path: NamePath<TValues>): readonly ValidationRuleIssue[] {
    return [...this.ensureState(path).errors.peek()]
  }

  // 清除单个字段的错误；没有错误时保持版本不变。
  clearFieldErrors(path: NamePath<TValues>): void {
    const errors = this.ensureState(path).errors

    if (errors.peek().length === 0) return

    errors.value = []
    this.errorRevision.value += 1
  }

  // 批量清除已注册字段的错误，并合并为一次版本通知。
  clearAllErrors(): void {
    let changed = false

    batchUpdates(() => {
      for (const state of this.states.values()) {
        if (state.errors.peek().length === 0) continue

        state.errors.value = []
        changed = true
      }

      if (changed) this.errorRevision.value += 1
    })
  }

  // 读取字段状态集合，并订阅状态集合本身的变化。
  getFieldStates(paths?: readonly NamePath<TValues>[]): readonly FieldState<TValues>[] {
    const states = this.selectStates(paths)

    void this.stateRevision.value

    return states
  }

  // 读取带路径的字段状态集合，并订阅状态集合本身的变化。
  getFieldEntries(
    paths?: readonly NamePath<TValues>[]
  ): IterableIterator<[NamePath<TValues>, FieldState<TValues>]> {
    void this.stateRevision.value

    return this.selectStates(paths)
      .map((state) => [state.path, state] as [NamePath<TValues>, FieldState<TValues>])
      .values()
  }

  // 复用字段状态集合读取，保持相同的集合依赖语义。
  getFieldValues(
    paths?: readonly NamePath<TValues>[]
  ): IterableIterator<FieldState<TValues>> {
    return this.getFieldStates(paths).values()
  }

  // 读取字段路径集合，并订阅后续新增状态。
  getFieldKeys(
    paths?: readonly NamePath<TValues>[]
  ): IterableIterator<NamePath<TValues>> {
    const states = this.selectStates(paths)

    void this.stateRevision.value

    return states.map((state) => state.path).values()
  }

  // 清理指定路径及后代的临时交互状态。
  clearFieldTransientState(path: NamePath<TValues>): void {
    for (const state of this.states.values()) {
      if (
        createFieldKey(state.path) === createFieldKey(path) ||
        isDescendantFieldPath(state.path, path)
      ) {
        this.clearState(state)
      }
    }
  }

  // 清空值树和所有状态；后续访问会按需重新物化状态。
  destroy(): void {
    this.values = {} as TValues
    this.initialValues = {}

    this.states.clear()
    this.interactionRevision.value += 1
    this.errorRevision.value += 1
  }

  /**
   * 获取或惰性创建指定路径的状态记录。
   *
   * @param path - 要物化状态的字段路径。
   * @returns 与规范化路径关联的状态记录。
   */
  private ensureState(path: NamePath<TValues>): FieldState<TValues> {
    const key = createFieldKey(path)

    const existing = this.states.get(key)

    if (existing) return existing

    const state: FieldState<TValues> = {
      path,
      valueRevision: createSignal(0),
      initialRevision: createSignal(0),
      touched: createSignal(false),
      pending: createSignal(false),
      pendingMessage: createSignal<readonly string[]>([]),
      errors: createSignal<readonly ValidationRuleIssue[]>([]),
    }

    this.states.set(key, state)
    this.stateRevision.value = this.stateRevision.peek() + 1

    return state
  }

  /**
   * 获取指定路径对应的已注册状态记录。
   *
   * @param paths - 可选的字段路径列表；省略时返回全部状态。
   * @returns 按字段路径顺序排列的状态记录。
   */
  private selectStates(paths?: readonly NamePath<TValues>[]): FieldState<TValues>[] {
    if (paths === undefined) return [...this.states.values()]

    const states = new Map<FieldKey, FieldState<TValues>>()

    for (const path of paths) {
      const state = this.ensureState(path)

      states.set(createFieldKey(path), state)
    }

    return [...states.values()]
  }

  /**
   * 使用结构共享写入当前值，并通知 Store 更新全表 revision。
   *
   * @param path - 当前值写入路径。
   * @param value - 要写入的值。
   * @returns 值实际发生变化时返回 `true`。
   */
  private writeCurrentValue(path: NamePath<TValues>, value: unknown): boolean {
    const previousValue = getByPath<TValues>(this.values, path)

    if (isEqual(previousValue, value)) return false

    this.values = setInWithStructuralSharing(
      this.values,
      toStructuralPathSegments(path),
      value
    ) as TValues

    this.onValueChanged()

    return true
  }

  /**
   * 使用结构共享写入初始值，并通知 Store 更新初始值 revision。
   *
   * @param path - 初始值写入路径。
   * @param value - 要写入的初始值。
   * @returns 初始值实际发生变化时返回 `true`。
   */
  private writeInitialValue(path: NamePath<TValues>, value: unknown): boolean {
    const previousValue = getByPath<TValues>(this.initialValues, path)

    if (isEqual(previousValue, value)) return false

    this.initialValues = setInWithStructuralSharing(
      this.initialValues,
      toStructuralPathSegments(path),
      value
    ) as Partial<TValues>
    this.onInitialValueChanged()

    return true
  }

  /**
   * 通知目标路径、祖先和后代的当前值依赖。
   *
   * @param path - 已发生当前值变化的路径。
   */
  private notifyValueChanged(path: NamePath<TValues>): void {
    for (const state of this.states.values()) {
      if (areSameOrOverlappingFieldPaths(state.path, path)) {
        state.valueRevision.value += 1
      }
    }
  }

  /**
   * 通知目标路径、祖先和后代的初始值依赖。
   *
   * @param path - 已发生初始值变化的路径。
   */
  private notifyInitialChanged(path: NamePath<TValues>): void {
    for (const state of this.states.values()) {
      if (areSameOrOverlappingFieldPaths(state.path, path)) {
        state.initialRevision.value += 1
      }
    }
  }

  /**
   * 按数组变更范围通知数组根、祖先和受影响行的当前值依赖。
   *
   * @param arrayPath - 发生结构变化的数组根路径。
   * @param change - 用于判断受影响索引范围的变更描述。
   */
  private notifyArrayValueChanged(
    arrayPath: NamePath<TValues>,
    change: FieldArrayChange
  ): void {
    const arraySegments = toNamePathSegments(arrayPath)

    for (const state of this.states.values()) {
      if (
        createFieldKey(state.path) === createFieldKey(arrayPath) ||
        isDescendantFieldPath(arrayPath, state.path)
      ) {
        state.valueRevision.value += 1
        continue
      }

      const fieldSegments = toNamePathSegments(state.path)

      if (fieldSegments.length <= arraySegments.length) continue

      const isDescendant = arraySegments.every(
        (segment, index) => fieldSegments[index] === segment
      )

      if (!isDescendant || !/^\d+$/.test(fieldSegments[arraySegments.length])) {
        continue
      }

      const index = Number(fieldSegments[arraySegments.length])

      const affected = change.ranges.some(
        (range) => index >= range.start && index <= range.end
      )

      if (affected) state.valueRevision.value += 1
    }
  }

  /**
   * 按数组变更范围清理数组根及受影响行的交互状态。
   *
   * @param arrayPath - 发生结构变化的数组根路径。
   * @param change - 用于判断受影响索引范围的变更描述。
   */
  private clearArrayTransientState(
    arrayPath: NamePath<TValues>,
    change: FieldArrayChange
  ): void {
    const arraySegments = toNamePathSegments(arrayPath)

    const shouldClearRoot = change.ranges.length > 0 || change.resetKeys === true

    for (const state of this.states.values()) {
      const fieldSegments = toNamePathSegments(state.path)

      if (createFieldKey(state.path) === createFieldKey(arrayPath)) {
        if (shouldClearRoot) this.clearState(state)
        continue
      }

      if (fieldSegments.length <= arraySegments.length) continue

      const isDescendant = arraySegments.every(
        (segment, index) => fieldSegments[index] === segment
      )

      if (!isDescendant) continue

      const indexSegment = fieldSegments[arraySegments.length]

      if (!/^\d+$/.test(indexSegment)) continue

      const index = Number(indexSegment)

      const affected = change.ranges.some(
        (range) => index >= range.start && index <= range.end
      )

      if (affected) this.clearState(state)
    }
  }

  /**
   * 同步数组结构变化带来的字段依赖、临时状态和过期错误。
   */
  notifyFieldArrayChange(path: NamePath<TValues>, change: FieldArrayChange): void {
    this.clearArrayTransientState(path, change)
    this.invalidateFieldArrayErrors(path, change)
    this.notifyArrayValueChanged(path, change)
  }

  /**
   * 清理单个状态记录中的 touched、pending 和 pending 消息。
   *
   * @param state - 要清理的字段状态记录。
   */
  private clearState(state: FieldState<TValues>): void {
    const touchedChanged = state.touched.peek()

    const pendingChanged = state.pending.peek() || state.pendingMessage.peek().length > 0

    if (!touchedChanged && !pendingChanged) return

    if (touchedChanged) {
      state.touched.value = false
    }

    if (pendingChanged) {
      state.pending.value = false
      state.pendingMessage.value = []
    }

    this.interactionRevision.value += 1
  }
}

/**
 * 创建 Store 专用字段状态和值树容器。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 值树和 Store 同步回调配置。
 * @returns 新的字段状态和值树容器。
 *
 * @example
 * ```typescript
 * const map = createFieldSignalMap({ initialValues: { name: "Ada" } })
 * map.setFieldValue("name", "Grace")
 * ```
 */
export function createFieldSignalMap<TValues extends Values = Values>(
  options: FieldSignalMapOptions<TValues> = {}
): FieldSignalMap<TValues> {
  return new FieldSignalMapImpl<TValues>(options)
}
