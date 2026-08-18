/**
 * 创建保持 Core API 的 Vue Instance。
 *
 * Instance 只负责把读取动作转成 Runtime 依赖收集，资源缓存和生命周期
 * 由所属 VueFormRuntime 管理。
 *
 * @module vue/bridge/formInstance
 */

import type { VueFieldDependency, VueFormDependency, VueSchemxInstance } from "./types"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

/** 创建 Instance 所需的 Runtime 追踪能力。 */
export interface VueFormInstanceDependencies<TValues extends Values> {
  trackField<TName extends NamePath<TValues>>(
    name: TName,
    dependency: VueFieldDependency
  ): void
  trackFieldsValue(names?: NamePath<TValues>[]): void
  trackForm(dependency: VueFormDependency): void
  destroy(): void
}

/**
 * 为 Core Form 创建保持完整 API 的 Vue Instance。
 *
 * @param form - 要包装的原始 Core Form。
 * @param dependencies - 所属 Runtime 提供的依赖追踪与销毁能力。
 * @returns 可被 Vue effect 追踪的 Instance。
 */
export function createVueFormInstance<TValues extends Values>(
  form: SchemxInstance<TValues>,
  dependencies: VueFormInstanceDependencies<TValues>
): VueSchemxInstance<TValues> {
  let destroyed = false

  const getFieldValue: SchemxInstance<TValues>["getFieldValue"] = (name) => {
    if (!destroyed) {
      dependencies.trackField(name, "value")
    }

    return form.getFieldValue(name)
  }

  const getFieldErrors: SchemxInstance<TValues>["getFieldErrors"] = (name) => {
    if (!destroyed) {
      dependencies.trackField(name, "errors")
    }

    return form.getFieldErrors(name)
  }

  const isFieldTouched: SchemxInstance<TValues>["isFieldTouched"] = (name) => {
    if (!destroyed) {
      dependencies.trackField(name, "touched")
    }

    return form.isFieldTouched(name)
  }

  const isFieldPending: SchemxInstance<TValues>["isFieldPending"] = (name) => {
    if (!destroyed) {
      dependencies.trackField(name, "pending")
    }

    return form.isFieldPending(name)
  }

  const getFieldsValue = ((names?: NamePath<TValues>[]) => {
    if (!destroyed) {
      dependencies.trackFieldsValue(names)
    }

    return form.getFieldsValue(names)
  }) as SchemxInstance<TValues>["getFieldsValue"]

  const getTouchedFields: SchemxInstance<TValues>["getTouchedFields"] = () => {
    if (!destroyed) {
      dependencies.trackForm("touchedFields")
    }

    return form.getTouchedFields()
  }

  const getPendingFields: SchemxInstance<TValues>["getPendingFields"] = () => {
    if (!destroyed) {
      dependencies.trackForm("pendingFields")
    }

    return form.getPendingFields()
  }

  const isLoading: SchemxInstance<TValues>["isLoading"] = () => {
    if (!destroyed) {
      dependencies.trackForm("loading")
    }

    return form.isLoading()
  }

  const destroy: SchemxInstance<TValues>["destroy"] = () => {
    if (destroyed) {
      return
    }

    destroyed = true
    dependencies.destroy()
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
