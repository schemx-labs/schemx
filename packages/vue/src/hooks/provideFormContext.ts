/**
 * Schemx 表单实例的 Vue provide/inject 适配。
 *
 * 负责在组件树中注册和读取 SchemxInstance，不负责创建或销毁实例。
 * 表单实例无论由 <SchemxForm> 内部创建，还是通过 form 属性从外部传入，
 * 都应由 <SchemxForm> 在 setup() 同步阶段调用 createFormContext() 注册。
 *
 * @module hooks/provideFormContext
 */
import { inject, type InjectionKey, onScopeDispose, provide } from "vue"

import {
  getVueFormBridge,
  getVueFormFacade,
  retainVueFormBridge,
  type VueSchemxInstance,
} from "../bridge"

import type { SchemxInstance, Values } from "@schemx/core"

// provide/inject 只传递运行时实例，不在此边界固定表单值泛型；
// 否则 SchemxInstance 的方法参数会使具体 TValues 与默认 Values 不兼容。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormContextInstance = VueSchemxInstance<any>

/**
 * SchemxInstance 在 Vue provide/inject 中使用的注入 key。
 *
 * 该 key 只应与同一份包代码导出的 createFormContext() 和 useFormContext()
 * 配套使用；重复安装不兼容版本的包不会共享此上下文。
 */
export const SCHEMX_FORM_INSTANCE_KEY = Symbol("schemx:instance") as InjectionKey<
  FormContextInstance
>

/**
 * 旧版表单实例注入 key。
 *
 * @deprecated 请使用 SCHEMX_FORM_INSTANCE_KEY。该别名仅用于兼容旧测试和旧适配代码。
 */
export const FORM_INSTANCE_KEY = SCHEMX_FORM_INSTANCE_KEY

/**
 * 向当前组件的后代组件提供表单实例。
 *
 * 必须在组件 setup() 的同步执行阶段调用；不要放入 onMounted、nextTick、
 * Promise 或其他异步回调中，否则 Vue 无法把上下文关联到当前组件实例。
 *
 * @typeParam TValues - 表单值类型
 * @param instance - 要提供给后代组件的表单实例
 *
 * @remarks
 * 该函数不接管实例所有权，也不会在组件卸载时销毁实例。
 *
 * @example
 * ```ts
 * const form = props.form ?? useForm(options)
 *
 * // 无论 form 来自外部还是内部，都统一注册上下文。
 * createFormContext(form)
 * ```
 */
export function createFormContext<TValues extends Values = Values>(
  instance: SchemxInstance<TValues>
): VueSchemxInstance<TValues> {
  const form = getVueFormFacade(instance)

  const releaseBridge = retainVueFormBridge(getVueFormBridge(form))

  provide<FormContextInstance>(SCHEMX_FORM_INSTANCE_KEY, form as FormContextInstance)
  onScopeDispose(releaseBridge)

  return form
}

/**
 * 获取最近祖先组件提供的表单实例。
 *
 * 该函数只能读取祖先组件注册的上下文，不能读取当前组件自身或后代组件
 * 调用 createFormContext() 提供的值。通常由 useField()、useWatch() 等其他
 * 表单 hook 间接调用。
 *
 * @typeParam TValues - 表单值类型
 * @returns 当前组件所属表单树中的 SchemxInstance
 *
 * @throws Error 当前组件不在已注册表单实例上下文的后代组件树中时抛出
 *
 * @example
 * ```ts
 * const form = useFormContext<FormValues>()
 * form.setFieldValue("name", "Schemx")
 * ```
 */
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
