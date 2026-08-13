/**
 * 创建保持 Core API 的 Vue Facade。
 *
 * @module vue/bridge/formFacade
 */

import type { VueFieldBridge, VueFormBridge, VueSchemxInstance } from "./types"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

/**
 * 创建 Facade 所需的 Bridge 生命周期操作。
 *
 * @internal
 * @typeParam TValues - Form 的值类型。
 */
export interface VueFormFacadeDependencies<TValues extends Values> {
  /**
   * 获取指定 Form 的共享 Bridge。
   *
   * @param form - 要获取 Bridge 的 Core Form。
   * @returns 对应的共享 Form Bridge。
   */
  getFormBridge(form: SchemxInstance<TValues>): VueFormBridge<TValues>
  /**
   * 获取指定字段的共享 Bridge。
   *
   * @param bridge - 所属 Form Bridge。
   * @param name - 字段路径。
   * @returns 对应字段的 Vue Bridge。
   */
  getFieldBridge<TName extends NamePath<TValues>>(
    bridge: VueFormBridge<TValues>,
    name: TName
  ): VueFieldBridge<TValues, TName>
  /**
   * 查找已创建的 Form Bridge，但不因销毁动作创建新 Bridge。
   *
   * @param form - 要查找的 Core Form。
   * @returns 已缓存的 Bridge；不存在时返回 `undefined`。
   */
  getCachedFormBridge(form: SchemxInstance<TValues>): VueFormBridge<TValues> | undefined
  /**
   * 销毁指定的共享 Form Bridge。
   *
   * @param bridge - 要销毁的 Form Bridge。
   */
  disposeFormBridge(bridge: VueFormBridge<TValues>): void
}

/**
 * 为 Core Form 创建保持完整 API 的 Vue Facade。
 *
 * Facade 将字段和聚合状态读取转发给 Core，并在读取期间访问 Vue Ref，
 * 从而让当前 Vue effect 建立对应的响应式依赖。
 *
 * @typeParam TValues - Form 的值类型。
 * @param form - 要包装的原始 Core Form。
 * @param dependencies - 提供 Bridge 获取、字段读取和销毁能力的运行时依赖。
 * @param dependencies.getFormBridge - 获取共享 Form Bridge。
 * @param dependencies.getFieldBridge - 获取共享字段 Bridge。
 * @param dependencies.getCachedFormBridge - 查找已缓存的 Form Bridge。
 * @param dependencies.disposeFormBridge - 销毁共享 Form Bridge。
 * @returns 可被 Vue effect 追踪的 Facade。
 *
 * @example
 * ```ts
 * const facade = createVueFormFacade(form, {
 *   getFormBridge,
 *   getFieldBridge,
 *   getCachedFormBridge,
 *   disposeFormBridge,
 * })
 * ```
 */
export function createVueFormFacade<TValues extends Values>(
  form: SchemxInstance<TValues>,
  dependencies: VueFormFacadeDependencies<TValues>
): VueSchemxInstance<TValues> {
  // Facade 销毁后不再访问 Bridge Ref，避免重新建立已释放的响应式依赖。
  let destroyed = false

  /**
   * 读取字段值，并在未销毁时收集对应字段 Ref 的 Vue 依赖。
   *
   * @param name - 要读取的字段路径。
   */
  const getFieldValue: SchemxInstance<TValues>["getFieldValue"] = (name) => {
    if (!destroyed) {
      const bridge = dependencies.getFormBridge(form)

      void dependencies.getFieldBridge(bridge, name).value.value
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
      const bridge = dependencies.getFormBridge(form)

      void dependencies.getFieldBridge(bridge, name).errors.value
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
      const bridge = dependencies.getFormBridge(form)

      void dependencies.getFieldBridge(bridge, name).touched.value
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
      const bridge = dependencies.getFormBridge(form)

      void dependencies.getFieldBridge(bridge, name).pending.value
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
      const bridge = dependencies.getFormBridge(form)

      if (names === undefined) {
        void bridge.values.value
      } else {
        for (const name of names) {
          void dependencies.getFieldBridge(bridge, name).value.value
        }
      }
    }

    return form.getFieldsValue(names)
  }) as SchemxInstance<TValues>["getFieldsValue"]

  /**
   * 读取 touched 字段，并收集聚合 touched Ref 的 Vue 依赖。
   */
  const getTouchedFields: SchemxInstance<TValues>["getTouchedFields"] = () => {
    if (!destroyed) {
      const bridge = dependencies.getFormBridge(form)

      void bridge.touchedFields.value
    }

    return form.getTouchedFields()
  }

  /**
   * 读取 pending 字段，并收集聚合 pending Ref 的 Vue 依赖。
   */
  const getPendingFields: SchemxInstance<TValues>["getPendingFields"] = () => {
    if (!destroyed) {
      const bridge = dependencies.getFormBridge(form)

      void bridge.pendingFields.value
    }

    return form.getPendingFields()
  }

  /**
   * 读取提交状态，并在 Vue effect 中收集对应 Ref 依赖。
   */
  const isLoading: SchemxInstance<TValues>["isLoading"] = () => {
    if (!destroyed) {
      const bridge = dependencies.getFormBridge(form)

      void bridge.loading.value
    }

    return form.isLoading()
  }

  /**
   * 销毁 Facade 关联的 Bridge，并继续销毁原始 Core Form。
   */
  const destroy: SchemxInstance<TValues>["destroy"] = () => {
    if (destroyed) {
      return
    }

    destroyed = true
    const bridge = dependencies.getCachedFormBridge(form)

    if (bridge) {
      dependencies.disposeFormBridge(bridge)
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
