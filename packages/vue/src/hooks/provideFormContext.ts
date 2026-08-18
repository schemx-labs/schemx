/**
 * Schemx 表单实例的 Vue provide/inject 适配。
 *
 * Context 对外提供 Vue Instance；Runtime 仅作为内部 Hook 的共享状态入口。
 *
 * @module hooks/provideFormContext
 */

import { inject, type InjectionKey, onScopeDispose, provide } from "vue"

import {
  acquireVueFormRuntime,
  type VueFormRuntime,
  type VueSchemxInstance,
} from "../bridge"

import type { SchemxInstance, Values } from "@schemx/core"

// provide/inject 不在运行时固定具体表单值泛型，消费端再恢复 TValues。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormContextInstance = VueSchemxInstance<any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormContextRuntime = VueFormRuntime<any>

/** SchemxInstance 在 Vue provide/inject 中使用的注入 key。 */
export const SCHEMX_FORM_INSTANCE_KEY = Symbol(
  "schemx:instance"
) as InjectionKey<FormContextInstance>

/** Runtime 供 Vue 内部 Hook 使用的注入 key。 */
const SCHEMX_FORM_RUNTIME_KEY = Symbol(
  "schemx:runtime"
) as InjectionKey<FormContextRuntime>

/** 旧版表单实例注入 key，仅保留为内部适配别名。 */
export const FORM_INSTANCE_KEY = SCHEMX_FORM_INSTANCE_KEY

/**
 * 向当前组件的后代组件提供表单实例和共享 Runtime。
 *
 * @param instance - 要提供给后代组件的 Core Form 或 Vue Instance。
 * @returns 当前 Runtime 对应的 Vue Instance。
 */
export function createFormContext<TValues extends Values = Values>(
  instance: SchemxInstance<TValues> | VueSchemxInstance<TValues>
): VueSchemxInstance<TValues> {
  const { runtime, release } = acquireVueFormRuntime(instance)

  provide<FormContextInstance>(
    SCHEMX_FORM_INSTANCE_KEY,
    runtime.instance as FormContextInstance
  )
  provide<FormContextRuntime>(SCHEMX_FORM_RUNTIME_KEY, runtime as FormContextRuntime)
  onScopeDispose(release)

  return runtime.instance
}

/** 获取最近祖先提供的 Vue Instance。 */
export function useFormContext<
  TValues extends Values = Values,
>(): VueSchemxInstance<TValues> {
  const instance = inject<FormContextInstance | null>(SCHEMX_FORM_INSTANCE_KEY, null)

  if (!instance) {
    throw new Error(
      "[schemx] useFormContext() must be called inside a <SchemxForm> descendant. " +
        "Ensure createFormContext(form) is called synchronously during setup()."
    )
  }

  return instance as VueSchemxInstance<TValues>
}

/**
 * 获取当前表单的内部 Runtime。
 *
 * 正常路径直接读取 Provider 已持有的 Runtime；测试或旧适配代码只提供
 * `SCHEMX_FORM_INSTANCE_KEY` 时，才为当前 scope 建立一个临时 owner。
 */
export function useFormRuntimeContext<
  TValues extends Values = Values,
>(): VueFormRuntime<TValues> {
  const providedRuntime = inject<FormContextRuntime | null>(SCHEMX_FORM_RUNTIME_KEY, null)

  if (providedRuntime) {
    return providedRuntime as VueFormRuntime<TValues>
  }

  const instance = useFormContext<TValues>()

  const acquired = acquireVueFormRuntime(instance)

  onScopeDispose(acquired.release)

  return acquired.runtime
}
