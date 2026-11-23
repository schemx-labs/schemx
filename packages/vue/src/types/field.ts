import { Ref } from "vue"

import type { FieldValue, NamePath, SchemxFieldInstance, Values } from "@schemx/core"

/**
 * Vue 层字段控制器实例
 *
 * 继承 core 层的 {@link SchemxFieldInstance}，
 * 将其 Signal 驱动的字段状态桥接为 Vue Ref，
 * 供模板、computed、watchEffect 等响应式上下文直接使用。
 *
 * @typeParam TValue - 表单值类型
 */
export interface FieldInstance<
  TValues extends Values = Values,
> extends SchemxFieldInstance<TValues> {
  /** 当前字段值（Vue shallowRef，由 Signal effect 驱动） */
  value: Ref<FieldValue<TValues, NamePath<TValues>> | undefined>
  /** 是否已被用户修改（Vue computed） */
  dirty: Ref<boolean>
  /** 当前校验错误信息（Vue computed） */
  error: Ref<string[] | undefined>
  /** 是否处于异步操作中（Vue computed，如文件上传、远程校验等） */
  pending: Ref<boolean>
}
