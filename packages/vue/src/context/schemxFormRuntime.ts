import { inject, provide } from "vue"
import type { InjectionKey } from "vue"

import type { FormCreator } from "../hooks/useForm"

const runtimeKey: InjectionKey<FormCreator | undefined> = Symbol("schemx:form-creator")

/**
 * 在包装组件中提供内层 Form 的创建器，不提供配置或管理组件。
 * @param creator - 绑定 Core 默认配置的同步创建函数。
 * @example provideSchemxFormRuntime(schemx.createForm)
 */
export function provideSchemxFormRuntime(creator: FormCreator): void {
  provide(runtimeKey, creator)
}

/**
 * 消费直接包装层的创建器，阻断其向未绑定的后代表单传播。
 * @example const creator = useSchemxFormRuntime()
 */
export function useSchemxFormRuntime(): FormCreator | undefined {
  const creator = inject(runtimeKey, undefined)

  provide(runtimeKey, undefined)

  return creator
}
