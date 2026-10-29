/**
 * 创建保持 Core API 的 Vue Instance。
 *
 * Instance 只负责把读取动作转成 Runtime 依赖收集，资源缓存和生命周期
 * 由所属 VueFormRuntime 管理。
 *
 * @module vue/bridge/formInstance
 */

import { createVueScrollToFieldDispatcher } from "./index"

import type { VueFormRuntime } from "./index"
import type { SchemxInstance } from "../types"
import type { SchemxInstance as CoreInstance, NamePath, Values } from "@schemx/core"

/**
 * 创建 Instance 所需的 Runtime 追踪能力。
 * @typeParam TValues - 表单值类型。
 */
type VueFormInstanceDependencies<TValues extends Values> = Pick<
  VueFormRuntime<TValues>,
  "trackState" | "trackField" | "trackFieldsValue" | "trackForm" | "destroy"
>

/**
 * 为 Core Form 创建保持完整 API 的 Vue Instance。
 *
 * 读取方法先建立 Vue 依赖，再返回 Core 的原始结果；写入和其他方法直接复用。
 * destroy 同时关闭 Runtime 和 Core；单纯释放 Runtime owner 不经过此方法。
 * @typeParam TValues - 表单值类型。
 * @param form - 要包装的原始 Core Form。
 * @param dependencies - 所属 Runtime 提供的依赖追踪与销毁能力。
 * @returns 可被 Vue effect 追踪的 Instance。
 *
 * @example
 * ```ts
 * const instance = createVueFormInstance(coreForm, runtimeDependencies)
 * ```
 */
export function createVueFormInstance<TValues extends Values>(
  form: CoreInstance<TValues>,
  dependencies: VueFormInstanceDependencies<TValues>
): SchemxInstance<TValues> {
  // 仅保证 Instance 销毁幂等；资源终态与依赖追踪由 Runtime 统一判断。
  let destroyed = false

  // 当前路径也通过 Form 实例桥接，字段工具无需另建响应式投影。
  const getFieldName: SchemxInstance<TValues>["getFieldName"] = (ref) => {
    dependencies.trackState(form.getFieldState(ref).name)

    return form.getFieldName(ref)
  }

  /**
   * 只追踪当前路径的值状态，避免依赖其他字段。
   * @param name - 本次查询的字段路径。
   */
  const getFieldValue: SchemxInstance<TValues>["getFieldValue"] = (name) => {
    dependencies.trackField(name, "value")

    return form.getFieldValue(name)
  }

  /**
   * 将错误查询连接到对应字段的 Vue 状态。
   * @param name - 要读取错误消息的字段路径。
   */
  const getFieldErrors: SchemxInstance<TValues>["getFieldErrors"] = (name) => {
    dependencies.trackField(name, "errors")

    return form.getFieldErrors(name)
  }

  /**
   * 将触摸状态查询连接到对应字段的 Vue 状态。
   * @param name - 要读取触摸状态的字段路径。
   */
  const isFieldTouched: SchemxInstance<TValues>["isFieldTouched"] = (name) => {
    dependencies.trackField(name, "touched")

    return form.isFieldTouched(name)
  }

  /**
   * 将业务操作状态查询连接到对应字段的 Vue 状态。
   * @param name - 要读取 pending 状态的字段路径。
   */
  const isFieldPending: SchemxInstance<TValues>["isFieldPending"] = (name) => {
    dependencies.trackField(name, "pending")

    return form.isFieldPending(name)
  }

  /**
   * 按查询范围追踪整表或局部值，返回结果仍遵循 Core 的重载契约。
   * @param names - 需要读取的路径；省略时读取整表值。
   */
  const getFieldsValue = ((names?: NamePath<TValues>[]) => {
    dependencies.trackFieldsValue(names)

    return form.getFieldsValue(names)
  }) as SchemxInstance<TValues>["getFieldsValue"]

  // 聚合查询只追踪 touched 路径列表，不订阅字段值。
  const getTouchedFields: SchemxInstance<TValues>["getTouchedFields"] = () => {
    dependencies.trackForm("touchedFields")

    return form.getTouchedFields()
  }

  // 聚合查询跟随 Core 的 pending 列表，保留其完整返回内容。
  const getPendingFields: SchemxInstance<TValues>["getPendingFields"] = () => {
    dependencies.trackForm("pendingFields")

    return form.getPendingFields()
  }

  // 提交或加载状态变化时使依赖当前查询的 Vue effect 更新。
  const isLoading: SchemxInstance<TValues>["isLoading"] = () => {
    dependencies.trackForm("loading")

    return form.isLoading()
  }

  // 先停 Vue 订阅再销毁 Core，避免销毁通知重新进入 Vue 投影。
  const destroy: SchemxInstance<TValues>["destroy"] = () => {
    if (destroyed) {
      return
    }

    destroyed = true
    dependencies.destroy()
    form.destroy()
  }

  // 由挂载的 Vue 表单组件注册 DOM 定位实现。
  const scrollToField = createVueScrollToFieldDispatcher<TValues>()

  return {
    ...form,
    scrollToField,
    getFieldName,
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
