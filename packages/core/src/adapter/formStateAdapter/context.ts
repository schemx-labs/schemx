import type { FormConfigModel } from "../../config/createFormConfig"
import type { ReadonlySignal } from "../../reactivity"
import type { Store } from "../../store"
import type { SchemxInstance, Values } from "../../types"

// 可枚举 Symbol 随框架实例复制，适配器无需公开的 form.state 入口。
const contextKey = Symbol("schemx:form-state-adapter-context")

/**
 * 适配器直接读取的表单操作和配置模型，不额外聚合状态。
 * @typeParam TValues - 表单值类型。
 */
export interface FormStateAdapterContext<TValues extends Values> {
  /**
   * 提供原生字段状态和全部资源操作的 Store。
   */
  readonly store: Store<TValues>
  /**
   * 保存运行期生效配置及其订阅的模型。
   */
  readonly configuration: FormConfigModel<TValues>
  /**
   * Form 的原生销毁信号。
   */
  readonly disposed: ReadonlySignal<boolean>
  /**
   * Form 的原生提交状态。
   */
  readonly loading: ReadonlySignal<boolean>
}

/**
 * 为适配器登记内部依赖，框架复制实例时保留同一上下文。
 * @typeParam TValues - 表单值类型。
 * @param form - 已组装的表单实例。
 * @param context - 当前表单的操作和配置模型。
 * @example setFormStateAdapterContext(form, { store, configuration, disposed, loading })
 */
export function setFormStateAdapterContext<TValues extends Values>(
  form: SchemxInstance<TValues>,
  context: FormStateAdapterContext<TValues>
): void {
  // 固定上下文身份，避免框架代理不可配置的 Symbol 属性值。
  Object.defineProperty(form, contextKey, {
    value: Object.freeze(context),
    enumerable: true,
  })
}

/**
 * 读取 Core 实例及其框架副本共用的适配器依赖。
 * @typeParam TValues - 表单值类型。
 * @param form - Core 创建的表单或保留其 Symbol 的框架实例。
 * @example const { store, configuration } = getFormStateAdapterContext(form)
 */
export function getFormStateAdapterContext<TValues extends Values>(
  form: SchemxInstance<TValues>
): FormStateAdapterContext<TValues> {
  return Reflect.get(form, contextKey) as FormStateAdapterContext<TValues>
}
