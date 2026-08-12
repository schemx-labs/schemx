/**
 * 面向 UI 适配层的 Form External Store。
 *
 * 将 Core 的细粒度响应式状态转换为标准的同步快照和订阅协议，不依赖具体 UI 框架。
 *
 * @module core/store/externalStore
 */

import { createFieldKey } from "../utils"

import type { StorePending } from "./store"
import type { FieldValue, NamePath, SchemxInstance, Values } from "../types"

/**
 * 框架适配层消费的通用同步外部状态协议。
 *
 * @typeParam TSnapshot - 该 Store 提供的稳定快照类型。
 */
export interface ExternalStore<TSnapshot> {
  /**
   * 同步读取当前稳定快照。
   *
   * @returns 当前 Store 的快照；状态未变化时保持同一快照引用。
   */
  getSnapshot(): TSnapshot
  /**
   * 注册状态变化监听；仅在快照真实变化时通知。
   *
   * @param listener - 快照更新后的无参通知回调。
   * @returns 可重复调用的取消订阅函数。
   */
  subscribe(listener: () => void): () => void
}

/**
 * 单字段的聚合状态快照。
 *
 * @typeParam TValues - 所属表单的值类型。
 * @typeParam TName - 字段路径类型。
 */
export interface FieldStateSnapshot<
  TValues extends Values,
  TName extends NamePath<TValues>,
> {
  /**
   * 当前字段值；字段尚未注册或没有值时可能为 `undefined`。
   */
  readonly value: FieldValue<TValues, TName> | undefined
  /**
   * 当前字段错误消息。
   */
  readonly errors: readonly string[]
  /**
   * 字段是否已被触碰。
   */
  readonly touched: boolean
  /**
   * 字段是否处于 pending 状态。
   */
  readonly pending: boolean
}

/**
 * 单字段状态的 External Store。
 *
 * @typeParam TValues - 所属表单的值类型。
 * @typeParam TName - 字段路径类型。
 */
export type FieldExternalStore<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = ExternalStore<FieldStateSnapshot<TValues, TName>>

/**
 * 一个 Form 所有共享状态的 External Store owner。
 *
 * Store 不拥有也不会销毁原始 Form；调用方可通过 `dispose()` 释放本 owner 创建的订阅和字段缓存。
 *
 * @typeParam TValues - Form 的值类型。
 */
export interface FormExternalStore<TValues extends Values> {
  /**
   * External Store 对应的原始 Core Form。
   */
  readonly form: SchemxInstance<TValues>
  /**
   * 全表值快照。
   */
  readonly values: ExternalStore<TValues>
  /**
   * 已 touched 字段路径快照。
   */
  readonly touchedFields: ExternalStore<readonly NamePath<TValues>[]>
  /**
   * pending 字段及其消息快照。
   */
  readonly pendingFields: ExternalStore<
    readonly StorePending<TValues, NamePath<TValues>>[]
  >
  /**
   * 当前是否正在执行提交流程。
   */
  readonly loading: ExternalStore<boolean>
  /**
   * 取得并缓存同一路径对应的字段 Store。
   *
   * @param name - 要读取的字段路径，用于生成缓存 key。
   * @returns 对应字段的 External Store。
   * @throws 当 owner 已经通过 `dispose()` 释放时抛出错误。
   */
  field<TName extends NamePath<TValues>>(name: TName): FieldExternalStore<TValues, TName>
  /**
   * 停止全部 Core effect 并清空字段 Store 缓存。
   *
   * 重复调用不会产生额外副作用。
   */
  dispose(): void
}

/**
 * 内部使用的、可主动停止的 External Store。
 */
interface ManagedExternalStore<TSnapshot> extends ExternalStore<TSnapshot> {
  /**
   * 释放监听器和 Core effect。
   */
  dispose(): void
}

/**
 * 创建一个 Form 的 External Store owner。
 *
 * @param form - 作为唯一状态源的 Core Form。
 * @returns 独立的 External Store owner。
 *
 * @remarks
 * owner 不拥有也不会销毁 `form`。各子 Store 会在首次订阅时启动 Core effect，
 * 在最后一个订阅取消后停止；调用 `dispose()` 可释放 owner 创建的 effect 和字段缓存。
 *
 * @example
 * ```ts
 * const externalStore = createFormExternalStore(form)
 * const unsubscribe = externalStore.values.subscribe(() => {
 *   console.log(externalStore.values.getSnapshot())
 * })
 * unsubscribe()
 * externalStore.dispose()
 * ```
 */
export function createFormExternalStore<TValues extends Values>(
  form: SchemxInstance<TValues>
): FormExternalStore<TValues> {
  // 由表单值快照驱动的共享 Store；track 确保 effect 追踪值依赖。
  const values = createManagedStore({
    form,
    track: () => {
      form.getFieldsValue()
    },
    readSnapshot: () => form.getFieldsSnapshot(),
    isSnapshotEqual: Object.is,
  })

  // 由 touched 字段路径快照驱动的共享 Store。
  const touchedFields = createManagedStore({
    form,
    readSnapshot: () => getTouchedFieldsSnapshot(form),
    isSnapshotEqual: areTouchedFieldsEqual,
  })

  // 由 pending 字段快照驱动的共享 Store。
  const pendingFields = createManagedStore({
    form,
    readSnapshot: () => getPendingFieldsSnapshot(form),
    isSnapshotEqual: arePendingFieldsEqual,
  })

  // 由 Controller 的响应式提交状态驱动。
  const loading = createManagedStore({
    form,
    readSnapshot: () => form.isLoading(),
    isSnapshotEqual: Object.is,
  })

  // 缓存按字段路径保存；Map 不需要保留某一具体路径对应的值类型。
  // 每次 field(name) 返回时会重新恢复当前 name 的精确 FieldValue 类型。
  const fieldStores = new Map<string, ManagedExternalStore<unknown>>()

  // owner 是否已经释放。
  let disposed = false

  /**
   * 返回同一路径的缓存字段 Store，并恢复当前路径的精确值类型。
   *
   * @param name - 要读取的字段路径。
   * @returns 对应字段的 External Store。
   * @throws 当 owner 已经通过 `dispose()` 释放时抛出错误。
   */
  const field: FormExternalStore<TValues>["field"] = (name) => {
    if (disposed) {
      throw new Error("[schemx] FormExternalStore has been disposed.")
    }

    const key = createFieldKey(name)

    const cachedStore = fieldStores.get(key)

    if (cachedStore) {
      return cachedStore as FieldExternalStore<TValues, typeof name>
    }

    const store = createManagedStore<TValues, FieldStateSnapshot<TValues, typeof name>>({
      form,
      readSnapshot: () => getFieldStateSnapshot(form, name),
      isSnapshotEqual: areFieldStateSnapshotsEqual,
    })

    fieldStores.set(key, store)

    return store
  }

  // 释放共享 Store 与按字段创建的 Store；原始 Form 由调用方继续管理。
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    values.dispose()
    touchedFields.dispose()
    pendingFields.dispose()
    loading.dispose()

    for (const store of fieldStores.values()) {
      store.dispose()
    }

    fieldStores.clear()
  }

  return {
    form,
    values,
    touchedFields,
    pendingFields,
    loading,
    field,
    dispose,
  }
}

/**
 * 创建由 Form effect 驱动的单个稳定快照 Store。
 *
 * @param options - Store 的状态源、快照读取器和比较策略。
 * @param options.form - 作为状态源并提供 effect 生命周期的 Core Form。
 * @param options.track - 读取快照前访问需要跟踪的响应式状态；未提供时不额外跟踪。
 * @param options.readSnapshot - 读取当前快照的函数。
 * @param options.isSnapshotEqual - 接收 previous 和 next 两份快照并判断其是否等价的函数。
 * @returns 可读取、可订阅且可主动释放的内部 Store。
 *
 * @remarks
 * Core effect 会在首次订阅时惰性启动，并在最后一个订阅取消或 Store 释放时停止。
 */
function createManagedStore<TValues extends Values, TSnapshot>(options: {
  form: SchemxInstance<TValues>
  track?: () => void
  readSnapshot: () => TSnapshot
  isSnapshotEqual: (previous: TSnapshot, next: TSnapshot) => boolean
}): ManagedExternalStore<TSnapshot> {
  const { form, track, readSnapshot, isSnapshotEqual } = options

  // 当前已注册的订阅者；有订阅者时才保持 Core effect 运行。
  const listeners = new Set<() => void>()

  // 最近一次通过比较器确认的稳定快照。
  let snapshot = readSnapshot()

  // 当前 Core effect 的释放函数。
  let disposeEffect: (() => void) | undefined

  // 当前 Store 是否已经释放。
  let disposed = false

  // 读取下一份快照，并在其真实变化时更新缓存。
  const refreshSnapshot = (): boolean => {
    const nextSnapshot = readSnapshot()

    if (isSnapshotEqual(snapshot, nextSnapshot)) {
      return false
    }

    snapshot = nextSnapshot

    return true
  }

  // 通知当前订阅者；复制集合以避免回调修改迭代过程。
  const notifyListeners = (): void => {
    for (const listener of [...listeners]) {
      listener()
    }
  }

  // 启动惰性的 Core effect，并跳过 effect 首次运行时的重复通知。
  const startEffect = (): void => {
    if (disposeEffect || disposed) {
      return
    }

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

  // 停止当前 Core effect，并清除释放函数引用。
  const stopEffect = (): void => {
    if (!disposeEffect) {
      return
    }

    disposeEffect()
    disposeEffect = undefined
  }

  // 无订阅者时主动刷新快照，保证同步读取仍能看到最新状态。
  const getSnapshot = (): TSnapshot => {
    if (listeners.size === 0 && !disposed) {
      refreshSnapshot()
    }

    return snapshot
  }

  /**
   * 注册监听器，并在快照真实变化时通知。
   *
   * @param listener - 快照更新后的无参通知回调。
   * @returns 可重复调用的取消订阅函数；Store 已释放时返回空操作函数。
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

  // 释放 Store 的订阅者和 Core effect；调用方通过 owner 统一管理字段 Store。
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

/**
 * 读取并以规范化路径顺序返回 touched 字段快照。
 *
 * @param form - 要读取的 Core Form。
 * @returns 按规范化字段路径排序的 touched 字段列表。
 */
function getTouchedFieldsSnapshot<TValues extends Values>(
  form: SchemxInstance<TValues>
): readonly NamePath<TValues>[] {
  return [...form.getTouchedFields()].sort(compareNamePaths)
}

/**
 * 比较两份 touched 字段快照。
 *
 * @param previous - 上一次的 touched 字段快照。
 * @param next - 下一次的 touched 字段快照。
 * @returns 两份快照的路径身份和顺序都相同时返回 `true`。
 */
function areTouchedFieldsEqual<TValues extends Values>(
  previous: readonly NamePath<TValues>[],
  next: readonly NamePath<TValues>[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every(
    (field, index) => createFieldKey(field) === createFieldKey(next[index])
  )
}

/**
 * 读取 pending 字段，并复制每条记录的消息数组。
 *
 * 字段路径沿用 Core 返回的路径值，结果按规范化字段路径排序。
 *
 * @param form - 要读取的 Core Form。
 * @returns pending 字段及其消息的快照列表。
 */
function getPendingFieldsSnapshot<TValues extends Values>(
  form: SchemxInstance<TValues>
): readonly StorePending<TValues, NamePath<TValues>>[] {
  return form
    .getPendingFields()
    .map((entry) => ({ field: entry.field, message: [...entry.message] }))
    .sort((previous, next) => compareNamePaths(previous.field, next.field))
}

/**
 * 比较两份 pending 字段快照的路径与消息内容。
 *
 * @param previous - 上一次的 pending 字段快照。
 * @param next - 下一次的 pending 字段快照。
 * @returns 两份快照的字段路径和消息内容都相同时返回 `true`。
 */
function arePendingFieldsEqual<TValues extends Values>(
  previous: readonly StorePending<TValues, NamePath<TValues>>[],
  next: readonly StorePending<TValues, NamePath<TValues>>[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every((entry, index) => {
    const nextEntry = next[index]

    return (
      createFieldKey(entry.field) === createFieldKey(nextEntry.field) &&
      areStringListsEqual(entry.message, nextEntry.message)
    )
  })
}

/**
 * 读取一个字段的完整聚合状态。
 *
 * @param form - 要读取的 Core Form。
 * @param name - 目标字段路径。
 * @returns 字段值、错误、触碰状态和 pending 状态组成的快照。
 */
function getFieldStateSnapshot<TValues extends Values, TName extends NamePath<TValues>>(
  form: SchemxInstance<TValues>,
  name: TName
): FieldStateSnapshot<TValues, TName> {
  return {
    value: form.getFieldValue(name),
    errors: form.getFieldErrors(name),
    touched: form.isFieldTouched(name),
    pending: form.isFieldPending(name),
  }
}

/**
 * 比较字段状态快照，只在真实状态变化时替换其引用。
 *
 * @param previous - 上一次的字段状态快照。
 * @param next - 下一次的字段状态快照。
 * @returns 字段值、错误、触碰状态和 pending 状态都相同时返回 `true`。
 */
function areFieldStateSnapshotsEqual<
  TValues extends Values,
  TName extends NamePath<TValues>,
>(
  previous: FieldStateSnapshot<TValues, TName>,
  next: FieldStateSnapshot<TValues, TName>
): boolean {
  return (
    Object.is(previous.value, next.value) &&
    previous.touched === next.touched &&
    previous.pending === next.pending &&
    areStringListsEqual(previous.errors, next.errors)
  )
}

/**
 * 比较两个字段路径的规范化身份。
 *
 * @param previous - 要比较的第一个字段路径。
 * @param next - 要比较的第二个字段路径。
 * @returns 规范化路径 key 的字典序比较结果。
 */
function compareNamePaths<TValues extends Values>(
  previous: NamePath<TValues>,
  next: NamePath<TValues>
): number {
  return createFieldKey(previous).localeCompare(createFieldKey(next))
}

/**
 * 比较两个字符串数组的长度与每一项内容。
 *
 * @param previous - 上一次的字符串数组。
 * @param next - 下一次的字符串数组。
 * @returns 两个数组长度相同且每一项内容都相同时返回 `true`。
 */
function areStringListsEqual(
  previous: readonly string[],
  next: readonly string[]
): boolean {
  if (previous.length !== next.length) {
    return false
  }

  return previous.every((message, index) => message === next[index])
}
