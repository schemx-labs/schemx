/**
 * Core Form 到 Vue 响应式状态的共享 Runtime。
 *
 * 每个 Core Form 只有一个稳定 Runtime 和一个 Vue Instance；响应式资源按
 * Vue owner 激活和释放，避免调用方同时管理 Runtime、Adapter 和订阅。
 *
 * @module vue/bridge/formBridge
 */

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

/** 同一 Core Form 只创建一个稳定 Runtime。 */
const runtimeCache = new WeakMap<object, VueFormRuntime<Values>>()

/** 用于从 Vue Instance 找回所属 Runtime。 */
const instanceRuntimeCache = new WeakMap<object, VueFormRuntime<Values>>()

/**
 * 获取并保留指定 Form 的共享 Runtime。
 *
 * 返回的 release 函数必须绑定到当前 owner 的 Vue scope；最后一个 owner
 * 释放后只销毁响应式资源，Runtime 和 Instance 身份保持稳定。
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

/** 获取已有 Runtime，或为输入的 Core Form 创建 Runtime。 */
function getOrCreateVueFormRuntime<TValues extends Values>(
  form: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): VueFormRuntime<TValues> {
  const cachedByInstance = instanceRuntimeCache.get(form as object)

  if (cachedByInstance) {
    return cachedByInstance as VueFormRuntime<TValues>
  }

  const cachedByCore = runtimeCache.get(form as object)

  if (cachedByCore) {
    return cachedByCore as VueFormRuntime<TValues>
  }

  const runtime = createVueFormRuntime(form as SchemxInstance<TValues>)

  runtimeCache.set(form as object, runtime as VueFormRuntime<Values>)
  instanceRuntimeCache.set(runtime.instance as object, runtime as VueFormRuntime<Values>)

  return runtime
}

/** 创建单个 Core Form 的稳定 Runtime。 */
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

    let viewSchemaState: VueFormResources<TValues>["viewSchemaState"]

    let disposed = false

    const dispose = (): void => {
      if (disposed) {
        return
      }

      disposed = true

      viewSchemaState?.dispose()
      fieldStates.clear()
      stateAdapter.dispose()
    }

    return {
      stateAdapter,
      values,
      touchedFields,
      pendingFields,
      loading,
      fieldStates,
      viewSchemaState,
      dispose,
    }
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
