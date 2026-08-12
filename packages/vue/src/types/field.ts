import type { ComputedRef, Ref } from "vue"

import type { FieldValue, NamePath, SchemxFieldInstance, Values } from "@schemx/core"

/**
 * Vue 层字段控制器实例
 *
 * 继承 core 层的 {@link SchemxFieldInstance}，
 * 将其 Signal 驱动的字段状态桥接为 Vue Ref，
 * 供模板、computed、watchEffect 等响应式上下文直接使用。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface FieldInstance<
  TValues extends Values = Values,
> extends SchemxFieldInstance<TValues> {
  /**
   * 当前字段路径。
   */
  readonly name: NamePath<TValues>
  /**
   * 当前字段值（Vue shallowRef，由共享 Field Bridge 驱动）。
   */
  value: Ref<FieldValue<TValues, NamePath<TValues>> | undefined>
  /**
   * 是否已被用户修改（只读 Vue computed）。
   */
  dirty: ComputedRef<boolean>
  /**
   * 当前校验错误信息（只读 Vue computed）。
   */
  errors: ComputedRef<readonly string[]>
  /**
   * 是否处于异步操作中（只读 Vue computed，如文件上传、远程校验等）。
   */
  pending: ComputedRef<boolean>
}
