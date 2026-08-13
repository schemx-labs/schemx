/**
 * Core Form 到 Vue 响应式状态的共享桥接。
 *
 * @module vue/bridge/formBridge
 */

import { createFormStateAdapter } from "@schemx/core/adapter"

import { getVueFieldBridge } from "./fieldBridge"
import { createVueFormFacade } from "./formFacade"
import { createVueShallowRef } from "./helpers"

import type {
  ManagedVueFieldBridge,
  PendingFieldsSnapshot,
  VueFormBridge,
  VueSchemxInstance,
} from "./types"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

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
 * 首次调用会创建 SnapshotSource 订阅；调用方应使用
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

  const facade = createVueFormFacade(coreForm, {
    getFormBridge: (bridgeForm) => getVueFormBridge(bridgeForm),
    getFieldBridge: (bridge, name) => getVueFieldBridge(bridge, name),
    getCachedFormBridge: (bridgeForm) => {
      const bridge = formBridgeCache.get(bridgeForm)

      return bridge as VueFormBridge<TValues> | undefined
    },
    disposeFormBridge: (bridge) => disposeVueFormBridge(bridge),
  })

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
  // 每个 owner 只允许减少一次引用计数。
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
 * 销毁共享 Bridge、全部字段订阅与 Core 状态适配器。
 *
 * @param bridge - 要销毁的共享 Form Bridge。
 *
 * @remarks
 * 销毁后 Bridge、字段 Ref 投影和状态适配器均不可继续使用；通常由
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
  bridge.stateAdapter.dispose()
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
  // Form Bridge 持有一个 Core 状态适配器，并负责将其快照同步到 Vue Ref。
  const stateAdapter = createFormStateAdapter(form)

  // 初始化时读取快照，后续只在 SnapshotSource 通知变化时写入 Ref。
  const values = createVueShallowRef<TValues>(stateAdapter.values.getSnapshot())

  const touchedFields = createVueShallowRef<readonly NamePath<TValues>[]>(
    stateAdapter.touchedFields.getSnapshot()
  )

  const pendingFields = createVueShallowRef<PendingFieldsSnapshot<TValues>>(
    stateAdapter.pendingFields.getSnapshot()
  )

  const loading = createVueShallowRef<boolean>(stateAdapter.loading.getSnapshot())

  // 字段 Bridge 与 Form Bridge 同生命周期，由 disposeVueFormBridge 统一释放。
  const fieldBridges = new Map<object, ManagedVueFieldBridge<TValues>>()

  // Form 级来源各自同步到对应的 Vue Ref。
  // 同步全表值快照。
  const syncValues = (): void => {
    values.value = stateAdapter.values.getSnapshot()
  }

  // 同步 touched 字段聚合快照。
  const syncTouchedFields = (): void => {
    touchedFields.value = stateAdapter.touchedFields.getSnapshot()
  }

  // 同步 pending 字段聚合快照。
  const syncPendingFields = (): void => {
    pendingFields.value = stateAdapter.pendingFields.getSnapshot()
  }

  /**
   * 将 Core 提交流程状态同步到 Vue Ref。
   */
  const syncLoading = (): void => {
    loading.value = stateAdapter.loading.getSnapshot()
  }

  // 分别保留四个来源的取消订阅函数，避免聚合来源之间相互影响。
  const unsubscribeValues = stateAdapter.values.subscribe(syncValues)

  const unsubscribeTouchedFields = stateAdapter.touchedFields.subscribe(syncTouchedFields)

  const unsubscribePendingFields = stateAdapter.pendingFields.subscribe(syncPendingFields)

  const unsubscribeLoading = stateAdapter.loading.subscribe(syncLoading)

  // 集中保存 Form 级来源的取消订阅函数，便于 Bridge 销毁时一次释放。
  const unsubscribe = (): void => {
    unsubscribeValues()
    unsubscribeTouchedFields()
    unsubscribePendingFields()
    unsubscribeLoading()
  }

  // Facade 与 Bridge 共享同一个 Core Form，但通过缓存保证唯一实例。
  const facade = getVueFormFacade(form)

  // Bridge 的 Ref、订阅和引用计数由当前 Form 统一持有。
  const bridge: VueFormBridge<TValues> = {
    form,
    stateAdapter,
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
