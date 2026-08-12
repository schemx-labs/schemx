/**
 * Core Form 到 Vue 响应式状态的共享桥接。
 *
 * @module vue/formBridge
 */

import { shallowRef } from "vue"
import type { ShallowRef } from "vue"

import { createFormExternalStore } from "@schemx/core/adapter"

import type { FieldValue, NamePath, SchemxInstance, Values } from "@schemx/core"
import type { FieldExternalStore, FormExternalStore } from "@schemx/core/adapter"

/**
 * 可在 Vue effect 中直接读取 Form 方法的结构兼容实例类型。
 *
 * Facade 与 Core Form 不同一引用，但保留完整的 `SchemxInstance` API。
 */
export type VueSchemxInstance<TValues extends Values = Values> = SchemxInstance<TValues>

/**
 * External Store 中 pending 字段的只读聚合快照。
 */
type PendingFieldsSnapshot<TValues extends Values> = readonly ReturnType<
  SchemxInstance<TValues>["getPendingFields"]
>[number][]

/**
 * Vue 中单个字段状态的 Ref 投影。
 */
export interface VueFieldBridge<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 对应的 Core 字段 External Store。
   */
  readonly store: FieldExternalStore<TValues, TName>
  /**
   * 当前字段值。
   */
  readonly value: ShallowRef<FieldValue<TValues, TName> | undefined>
  /**
   * 当前字段错误消息。
   */
  readonly errors: ShallowRef<readonly string[]>
  /**
   * 当前字段 touched 状态。
   */
  readonly touched: ShallowRef<boolean>
  /**
   * 当前字段 pending 状态。
   */
  readonly pending: ShallowRef<boolean>
}

/**
 * 包含唯一 Vue Facade 的共享 Form Bridge。
 */
export interface VueFormBridge<TValues extends Values = Values> {
  /**
   * 原始 Core Form。
   */
  readonly form: SchemxInstance<TValues>
  /**
   * 该 Form 的 Core External Store owner。
   */
  readonly externalStore: FormExternalStore<TValues>
  /**
   * 全表值 Ref。
   */
  readonly values: ShallowRef<TValues>
  /**
   * 已 touched 字段 Ref。
   */
  readonly touchedFields: ShallowRef<readonly NamePath<TValues>[]>
  /**
   * pending 字段 Ref。
   */
  readonly pendingFields: ShallowRef<PendingFieldsSnapshot<TValues>>
  /**
   * 当前表单提交状态的 Vue Ref 投影。
   */
  readonly loading: ShallowRef<boolean>
  /**
   * 按 Field External Store 身份缓存的字段 Ref 投影。
   */
  readonly fieldBridges: Map<object, ManagedVueFieldBridge<TValues>>
  /**
   * 正在使用当前 Bridge 的 Vue owner 数量。
   */
  refCount: number
  /**
   * Bridge 是否已被手动或自动释放。
   */
  destroyed: boolean
  /**
   * 取消 Form 级 External Store 订阅。
   */
  readonly unsubscribe: () => void
  /**
   * 与原始 Core Form 对应的唯一 Vue Facade。
   */
  readonly facade: VueSchemxInstance<TValues>
}

/**
 * 内部使用的、可停止订阅的字段 Ref 投影。
 */
interface ManagedVueFieldBridge<TValues extends Values> extends VueFieldBridge<TValues> {
  dispose(): void
}

/**
 * 同一 Core Form 只创建一个共享 Vue Bridge。
 */
const formBridgeCache = new WeakMap<object, VueFormBridge<Values>>()

/**
 * 同一 Core Form 始终复用同一个 Vue Facade。
 */
const formFacadeCache = new WeakMap<object, VueSchemxInstance<Values>>()

/**
 * 用于从公开 Facade 回到原始 Core Form。
 */
const facadeCoreFormCache = new WeakMap<object, SchemxInstance<Values>>()

/**
 * 将 Vue 的条件 Ref 返回类型收窄为当前桥接所需的 shallow Ref。
 *
 * @param value - 要包装为 shallow Ref 的当前值。
 * @returns 包装后的 shallow Ref。
 */
function createVueShallowRef<TValue>(value: TValue): ShallowRef<TValue> {
  return shallowRef(value) as ShallowRef<TValue>
}

/**
 * 返回原始 Core Form；普通 Core Form 输入时保持引用不变。
 *
 * @param form - Core Form 或 Vue Facade。
 * @returns 原始 Core Form。
 *
 * @example
 * ```ts
 * const coreForm = getCoreForm(form)
 * const snapshot = coreForm.getFieldsSnapshot()
 * ```
 */
export function getCoreForm<TValues extends Values = Values>(
  form: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): SchemxInstance<TValues> {
  const coreForm = facadeCoreFormCache.get(form as object)

  return (coreForm ?? form) as SchemxInstance<TValues>
}

/**
 * 获取指定 Form 的共享 Vue Bridge。
 *
 * @param form - Core Form 或 Vue Facade。
 * @returns 对应的共享 Bridge。
 *
 * @remarks
 * 首次调用会创建 External Store 订阅；调用方应使用
 * `retainVueFormBridge()` 持有 Bridge，并在 owner 销毁时释放。
 *
 * @example
 * ```ts
 * const bridge = getVueFormBridge(form)
 * const release = retainVueFormBridge(bridge)
 * onScopeDispose(release)
 * ```
 */
export function getVueFormBridge<TValues extends Values = Values>(
  form: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): VueFormBridge<TValues> {
  const coreForm = getCoreForm(form)

  const cachedBridge = formBridgeCache.get(coreForm)

  if (cachedBridge) {
    return cachedBridge as VueFormBridge<TValues>
  }

  const bridge = createVueFormBridge(coreForm)

  formBridgeCache.set(coreForm, bridge as VueFormBridge<Values>)

  return bridge
}

/**
 * 获取指定 Form 的唯一 Vue Facade。
 *
 * @param form - Core Form 或已有 Vue Facade。
 * @returns 可被 Vue effect 追踪的 Facade。
 *
 * @example
 * ```ts
 * const reactiveForm = getVueFormFacade(form)
 * watchEffect(() => {
 *   console.log(reactiveForm.getFieldsValue())
 * })
 * ```
 */
export function getVueFormFacade<TValues extends Values = Values>(
  form: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): VueSchemxInstance<TValues> {
  const coreForm = getCoreForm(form)

  const cachedFacade = formFacadeCache.get(coreForm)

  if (cachedFacade) {
    return cachedFacade as VueSchemxInstance<TValues>
  }

  const facade = createVueFormFacade(coreForm)

  formFacadeCache.set(coreForm, facade as VueSchemxInstance<Values>)
  facadeCoreFormCache.set(facade as object, coreForm as SchemxInstance<Values>)

  return facade
}

/**
 * 为一个 Vue owner 保留 Bridge，并返回对应的幂等释放函数。
 *
 * @param bridge - 要保留的共享 Bridge。
 * @returns 释放当前 owner 的函数。
 *
 * @remarks
 * 返回的释放函数可安全重复调用；最后一个 owner 释放后，Bridge 会自动销毁。
 *
 * @example
 * ```ts
 * const bridge = getVueFormBridge(form)
 * const release = retainVueFormBridge(bridge)
 * onScopeDispose(release)
 * ```
 */
export function retainVueFormBridge<TValues extends Values>(
  bridge: VueFormBridge<TValues>
): () => void {
  if (bridge.destroyed) {
    return () => {}
  }

  bridge.refCount++
  let released = false

  return () => {
    if (released || bridge.destroyed) {
      return
    }

    released = true
    bridge.refCount--

    if (bridge.refCount === 0) {
      disposeVueFormBridge(bridge)
    }
  }
}

/**
 * 获取一个字段的共享 Vue Ref 投影。
 *
 * @param bridge - 所属 Form Bridge。
 * @param name - 字段路径。
 * @returns 对应字段的共享 Vue Bridge。
 *
 * @example
 * ```ts
 * const bridge = getVueFormBridge(form)
 * const field = getVueFieldBridge(bridge, "email")
 * watchEffect(() => console.log(field.value.value))
 * ```
 */
export function getVueFieldBridge<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(bridge: VueFormBridge<TValues>, name: TName): VueFieldBridge<TValues, TName> {
  const store = bridge.externalStore.field(name)

  const cachedBridge = bridge.fieldBridges.get(store as object)

  if (cachedBridge) {
    return cachedBridge as VueFieldBridge<TValues, TName>
  }

  const snapshot = store.getSnapshot()

  const value = createVueShallowRef<FieldValue<TValues, TName> | undefined>(
    snapshot.value
  )

  const errors = createVueShallowRef<readonly string[]>(snapshot.errors)

  const touched = createVueShallowRef<boolean>(snapshot.touched)

  const pending = createVueShallowRef<boolean>(snapshot.pending)

  const updateFieldRefs = (): void => {
    const nextSnapshot = store.getSnapshot()

    if (!Object.is(value.value, nextSnapshot.value)) {
      value.value = nextSnapshot.value
    }

    if (!areStringListsEqual(errors.value, nextSnapshot.errors)) {
      errors.value = nextSnapshot.errors
    }

    if (touched.value !== nextSnapshot.touched) {
      touched.value = nextSnapshot.touched
    }

    if (pending.value !== nextSnapshot.pending) {
      pending.value = nextSnapshot.pending
    }
  }

  const unsubscribe = store.subscribe(updateFieldRefs)

  const dispose = (): void => {
    unsubscribe()
  }

  const fieldBridge: ManagedVueFieldBridge<TValues> = {
    store,
    value,
    errors,
    touched,
    pending,
    dispose,
  }

  bridge.fieldBridges.set(store as object, fieldBridge)

  return fieldBridge as VueFieldBridge<TValues, TName>
}

/**
 * 销毁共享 Bridge、全部字段订阅与 Core External Store。
 *
 * @param bridge - 要销毁的共享 Form Bridge。
 *
 * @remarks
 * 销毁后 Bridge、字段 Ref 投影和 External Store 均不可继续使用；通常由
 * `retainVueFormBridge()` 返回的最后一个释放函数自动触发。
 *
 * @example
 * ```ts
 * disposeVueFormBridge(bridge)
 * ```
 */
export function disposeVueFormBridge<TValues extends Values>(
  bridge: VueFormBridge<TValues>
): void {
  if (bridge.destroyed) {
    return
  }

  bridge.destroyed = true
  bridge.refCount = 0
  bridge.unsubscribe()

  for (const fieldBridge of bridge.fieldBridges.values()) {
    fieldBridge.dispose()
  }

  bridge.fieldBridges.clear()
  bridge.externalStore.dispose()
  formBridgeCache.delete(bridge.form)
}

/**
 * 创建单个 Core Form 的 Vue Bridge 和唯一 Facade。
 *
 * @param form - 要桥接的原始 Core Form。
 * @returns 新建的共享 Vue Form Bridge。
 */
function createVueFormBridge<TValues extends Values>(
  form: SchemxInstance<TValues>
): VueFormBridge<TValues> {
  const externalStore = createFormExternalStore(form)

  const values = createVueShallowRef<TValues>(externalStore.values.getSnapshot())

  const touchedFields = createVueShallowRef<readonly NamePath<TValues>[]>(
    externalStore.touchedFields.getSnapshot()
  )

  const pendingFields = createVueShallowRef<PendingFieldsSnapshot<TValues>>(
    externalStore.pendingFields.getSnapshot()
  )

  const loading = createVueShallowRef<boolean>(externalStore.loading.getSnapshot())

  const fieldBridges = new Map<object, ManagedVueFieldBridge<TValues>>()

  const syncValues = (): void => {
    values.value = externalStore.values.getSnapshot()
  }

  const syncTouchedFields = (): void => {
    touchedFields.value = externalStore.touchedFields.getSnapshot()
  }

  const syncPendingFields = (): void => {
    pendingFields.value = externalStore.pendingFields.getSnapshot()
  }

  /**
   * 将 Core 提交流程状态同步到 Vue Ref。
   */
  const syncLoading = (): void => {
    loading.value = externalStore.loading.getSnapshot()
  }

  const unsubscribeValues = externalStore.values.subscribe(syncValues)

  const unsubscribeTouchedFields =
    externalStore.touchedFields.subscribe(syncTouchedFields)

  const unsubscribePendingFields =
    externalStore.pendingFields.subscribe(syncPendingFields)

  const unsubscribeLoading = externalStore.loading.subscribe(syncLoading)

  const unsubscribe = (): void => {
    unsubscribeValues()
    unsubscribeTouchedFields()
    unsubscribePendingFields()
    unsubscribeLoading()
  }

  const facade = getVueFormFacade(form)

  const bridge: VueFormBridge<TValues> = {
    form,
    externalStore,
    values,
    touchedFields,
    pendingFields,
    loading,
    fieldBridges,
    refCount: 0,
    destroyed: false,
    unsubscribe,
    facade,
  }

  return bridge
}

/**
 * 为 Core Form 创建保持完整 API 的 Vue Facade。
 *
 * @param form - 要包装的原始 Core Form。
 * @returns 可被 Vue effect 追踪的 Facade。
 */
function createVueFormFacade<TValues extends Values>(
  form: SchemxInstance<TValues>
): VueSchemxInstance<TValues> {
  let destroyed = false

  /**
   * 读取字段值，并在未销毁时收集对应字段 Ref 的 Vue 依赖。
   *
   * @param name - 要读取的字段路径。
   */
  const getFieldValue: SchemxInstance<TValues>["getFieldValue"] = (name) => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      void getVueFieldBridge(bridge, name).value.value
    }

    return form.getFieldValue(name)
  }

  /**
   * 读取字段错误，并在未销毁时收集对应字段 Ref 的 Vue 依赖。
   *
   * @param name - 要读取错误的字段路径。
   */
  const getFieldErrors: SchemxInstance<TValues>["getFieldErrors"] = (name) => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      void getVueFieldBridge(bridge, name).errors.value
    }

    return form.getFieldErrors(name)
  }

  /**
   * 读取字段 touched 状态，并在未销毁时收集对应字段 Ref 的 Vue 依赖。
   *
   * @param name - 要读取状态的字段路径。
   */
  const isFieldTouched: SchemxInstance<TValues>["isFieldTouched"] = (name) => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      void getVueFieldBridge(bridge, name).touched.value
    }

    return form.isFieldTouched(name)
  }

  /**
   * 读取字段 pending 状态，并在未销毁时收集对应字段 Ref 的 Vue 依赖。
   *
   * @param name - 要读取状态的字段路径。
   */
  const isFieldPending: SchemxInstance<TValues>["isFieldPending"] = (name) => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      void getVueFieldBridge(bridge, name).pending.value
    }

    return form.isFieldPending(name)
  }

  /**
   * 读取全部或指定字段值，并为读取范围收集 Vue 依赖。
   *
   * @param names - 可选的字段路径列表；省略时追踪完整表单值。
   */
  const getFieldsValue = ((names?: NamePath<TValues>[]) => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      if (names === undefined) {
        void bridge.values.value
      } else {
        for (const name of names) {
          void getVueFieldBridge(bridge, name).value.value
        }
      }
    }

    return form.getFieldsValue(names)
  }) as SchemxInstance<TValues>["getFieldsValue"]

  const getTouchedFields: SchemxInstance<TValues>["getTouchedFields"] = () => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      void bridge.touchedFields.value
    }

    return form.getTouchedFields()
  }

  const getPendingFields: SchemxInstance<TValues>["getPendingFields"] = () => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      void bridge.pendingFields.value
    }

    return form.getPendingFields()
  }

  /**
   * 读取提交状态，并在 Vue effect 中收集对应 Ref 依赖。
   */
  const isLoading: SchemxInstance<TValues>["isLoading"] = () => {
    if (!destroyed) {
      const bridge = getVueFormBridge(form)

      void bridge.loading.value
    }

    return form.isLoading()
  }

  const destroy: SchemxInstance<TValues>["destroy"] = () => {
    if (destroyed) {
      return
    }

    destroyed = true
    const bridge = formBridgeCache.get(form) as VueFormBridge<TValues> | undefined

    if (bridge) {
      disposeVueFormBridge(bridge)
    }

    form.destroy()
  }

  return {
    ...form,
    getFieldValue,
    getFieldErrors,
    isFieldTouched,
    isFieldPending,
    getFieldsValue,
    getTouchedFields,
    getPendingFields,
    isLoading,
    destroy,
  }
}

/**
 * 比较错误消息内容，避免无变化时写入 Vue Ref。
 *
 * @param previous - 当前 Ref 中保存的错误消息列表。
 * @param next - External Store 返回的最新错误消息列表。
 * @returns 两个列表的长度和每一项都相同时返回 true。
 */
function areStringListsEqual(
  previous: readonly string[],
  next: readonly string[]
): boolean {
  return (
    previous.length === next.length &&
    previous.every((value, index) => value === next[index])
  )
}
