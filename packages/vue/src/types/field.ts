import type { ComputedRef, Ref, VNodeChild } from "vue"

import type {
  FieldValue,
  NamePath,
  SchemxComponentProps,
  SchemxFieldInstance,
  SchemxInstance,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  Values,
} from "@schemx/core"

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

/** 字段区域 Slot 共用的上下文参数。 */
export interface SchemxFieldSlotProps<TValues extends Values = Values> {
  /** 当前字段完整的已解析 ViewSchema。 */
  schema: SchemxViewFieldSchema<TValues>
  /** 当前 Renderer 的完整运行时 Props。 */
  componentProps: SchemxComponentProps<TValues>
  /** 当前字段值。 */
  value: FieldValue<TValues, NamePath<TValues>> | undefined
  /** 当前字段控制器。 */
  field: FieldInstance<TValues>
  /** 当前表单实例。 */
  form: SchemxInstance<TValues>
}

/** 字段内容 Slot 额外获得的默认 Renderer VNode。 */
export interface SchemxFieldContentSlotProps<
  TValues extends Values = Values,
> extends SchemxFieldSlotProps<TValues> {
  columnElement: VNodeChild
}

/** 字段错误 Slot 额外获得的当前错误列表。 */
export interface SchemxFieldErrorSlotProps<
  TValues extends Values = Values,
> extends SchemxFieldSlotProps<TValues> {
  errors: readonly string[]
}

/** 分组区域 Slot 共用的上下文参数。 */
export interface SchemxGroupSlotProps<TValues extends Values = Values> {
  /** 当前分组完整的已解析 ViewSchema。 */
  schema: SchemxViewGroupSchema<TValues>
  /** 当前是否收起。 */
  collapsed: boolean
  /** 当前分组是否可收起。 */
  collapsible: boolean
  /** 当前分组是否禁用。 */
  disabled: boolean
  /** 当前分组是否只读。 */
  readonly: boolean
  /** 切换分组收起状态。禁用或不可折叠时无效果。 */
  toggle: () => void
}
