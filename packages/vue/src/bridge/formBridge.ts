/**
 * Core Form 到 Vue 响应式状态的共享 Runtime。
 *
 * 每个 Core Form 只有一个稳定 Runtime 和一个 Vue Instance；响应式资源按
 * Vue owner 激活和释放，避免调用方同时管理 Runtime、Adapter 和订阅。
 *
 * @module vue/bridge/formBridge
 */

import { getCurrentScope, onScopeDispose } from "vue"

import { createFormStateAdapter } from "@schemx/core/adapter"

import { getVueFieldState } from "./fieldBridge"
import { createVueFormInstance } from "./formInstance"
import { bindSnapshotSource } from "./helpers"
import { createVueViewSchemaState } from "./viewSchemaBridge"

import type {
  VueFieldDependency,
  VueFieldState,
  VueFormDependency,
  VueFormResources,
  VueFormRuntime,
  VueSchemxInstance,
} from "./types"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

/**
 * 同一 Core Form 只创建一个稳定 Runtime。
 */
const runtimeCache = new WeakMap<object, VueFormRuntime<Values>>()

/**
 * 在当前 Vue effect scope 中获取共享 Runtime。
 *
 * 每次调用都会为当前 scope 保留一个 Runtime owner，并在 scope 停止时自动
 * 释放该 owner；最后一个 owner 释放后，字段和表单级响应式资源才会回收。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要桥接的 Core Form 或 Vue Form Instance。
 * @returns 当前 Form 对应的共享 Runtime。
 * @throws 当前没有活动的 Vue effect scope 时抛出错误。
 *
 * @example
 * ```ts
 * // 在 setup() 或其他活动的 Vue effect scope 中调用。
 * const runtime = useVueFormRuntime(form)
 * const values = runtime.getValuesRef()
 * ```
 */
export function useVueFormRuntime<TValues extends Values = Values>(
  form: SchemxInstance<TValues>
): VueFormRuntime<TValues> {
  if (!getCurrentScope()) {
    throw new Error("[schemx] useVueFormRuntime() requires an active Vue scope.")
  }

  const { runtime, release } = acquireVueFormRuntime(form)

  onScopeDispose(release)

  return runtime
}

/**
 * 获取并保留指定 Form 的共享 Runtime。
 *
 * 返回的 release 函数必须绑定到当前 owner 的 Vue scope；最后一个 owner
 * 释放后只销毁响应式资源，Runtime 和 Instance 身份保持稳定。
 *
 * @typeParam TValues - 表单值类型。
 * @param form - 要桥接的 Core Form 或 Vue Form Instance。
 * @returns 共享 Runtime 及与当前 owner 对应的释放函数。
 *
 * @example
 * ```ts
 * const { runtime, release } = acquireVueFormRuntime(form)
 * try {
 *   runtime.getValuesRef()
 * } finally {
 *   release()
 * }
 * ```
 */
export function acquireVueFormRuntime<TValues extends Values = Values>(
  form: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): {
  runtime: VueFormRuntime<TValues>
  release: () => void
} {
  const runtime = getOrCreateVueFormRuntime(form)

  const release = runtime.retain()

  return {
    runtime,
    release,
  }
}

/**
 * 获取已有 Runtime，或为输入的 Core Form 创建 Runtime。
 *
 * Core Form 和桥接后的 Vue Instance 都会映射到同一个 Runtime，避免同一表单
 * 因不同入口重复创建状态订阅。
 *
 * @param form - 要查找或创建 Runtime 的 Form Instance。
 */
function getOrCreateVueFormRuntime<TValues extends Values>(
  form: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): VueFormRuntime<TValues> {
  const cachedByCore = runtimeCache.get(form as object)

  if (cachedByCore) {
    return cachedByCore as VueFormRuntime<TValues>
  }

  const runtime = createVueFormRuntime(form as SchemxInstance<TValues>)

  runtimeCache.set(form as object, runtime as VueFormRuntime<Values>)
  runtimeCache.set(runtime.instance as object, runtime as VueFormRuntime<Values>)

  return runtime
}

/**
 * 创建单个 Core Form 的稳定 Runtime。
 *
 * Runtime 本身保持稳定；只有存在 owner 时才创建并保留 Vue 响应式资源。
 *
 * @param core - 要桥接的 Core Form。
 */
function createVueFormRuntime<TValues extends Values>(
  core: SchemxInstance<TValues>
): VueFormRuntime<TValues> {
  let resources: VueFormResources<TValues> | undefined

  let ownerCount = 0

  let destroyed = false

  const createResources = (): VueFormResources<TValues> => {
    const stateAdapter = createFormStateAdapter(core)

    const values = bindSnapshotSource(stateAdapter.values)

    const touchedFields = bindSnapshotSource(stateAdapter.touchedFields)

    const pendingFields = bindSnapshotSource(stateAdapter.pendingFields)

    const loading = bindSnapshotSource(stateAdapter.loading)

    const fieldStates = new Map<object, VueFieldState<TValues>>()

    let disposed = false

    const dispose = (): void => {
      if (disposed) {
        return
      }

      disposed = true

      currentResources.viewSchemaState?.dispose()
      fieldStates.clear()
      stateAdapter.dispose()
    }

    const currentResources: VueFormResources<TValues> = {
      stateAdapter,
      values,
      touchedFields,
      pendingFields,
      loading,
      fieldStates,
      dispose,
    }

    return currentResources
  }

  const ensureResources = (): VueFormResources<TValues> => {
    if (destroyed) {
      throw new Error("[schemx] Vue Form Runtime has been destroyed.")
    }

    resources ??= createResources()

    return resources
  }

  const disposeResources = (): void => {
    const currentResources = resources

    if (!currentResources) {
      return
    }

    resources = undefined
    currentResources.dispose()
  }

  const retain = (): (() => void) => {
    if (destroyed) {
      return () => {}
    }

    ensureResources()
    ownerCount++

    let released = false

    return () => {
      if (released || destroyed) {
        return
      }

      released = true
      ownerCount--

      if (ownerCount === 0) {
        disposeResources()
      }
    }
  }

  const trackField = <TName extends NamePath<TValues>>(
    name: TName,
    dependency: VueFieldDependency
  ): void => {
    if (!resources) {
      return
    }

    const fieldState = getVueFieldState(resources, name)

    void fieldState[dependency].value
  }

  const trackFieldsValue = (names?: NamePath<TValues>[]): void => {
    if (!resources) {
      return
    }

    if (names === undefined) {
      void resources.values.value

      return
    }

    for (const name of names) {
      void getVueFieldState(resources, name).value.value
    }
  }

  const trackForm = (dependency: VueFormDependency): void => {
    if (!resources) {
      return
    }

    switch (dependency) {
      case "values":
        void resources.values.value
        break
      case "touchedFields":
        void resources.touchedFields.value
        break
      case "pendingFields":
        void resources.pendingFields.value
        break
      case "loading":
        void resources.loading.value
        break
    }
  }

  const getValuesRef = (): VueFormResources<TValues>["values"] => {
    return ensureResources().values
  }

  const getFieldState = <TName extends NamePath<TValues>>(name: TName) => {
    return getVueFieldState(ensureResources(), name)
  }

  const getViewSchemaState = () => {
    const currentResources = ensureResources()

    const viewSchemaState = (currentResources.viewSchemaState ??=
      createVueViewSchemaState(core))

    return viewSchemaState
  }

  const destroy = (): void => {
    if (destroyed) {
      return
    }

    destroyed = true
    ownerCount = 0
    disposeResources()
  }

  const instance = createVueFormInstance(core, {
    trackField,
    trackFieldsValue,
    trackForm,
    destroy,
  })

  const runtime: VueFormRuntime<TValues> = {
    core,
    instance,
    retain,
    trackField,
    trackFieldsValue,
    trackForm,
    getValuesRef,
    getFieldState,
    getViewSchemaState,
    destroy,
  }

  return runtime
}
