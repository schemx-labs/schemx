/**
 * Vue 字段控制器、Renderer Props 与插槽上下文类型。
 *
 * @module types/field
 */

import type { ComputedRef, Ref, VNodeChild } from "vue"

import type {
  SchemxBaseComponentProps as CoreSchemxBaseComponentProps,
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
 * Vue Renderer 的公共 Props。
 *
 * 该类型属于 Vue 适配层；Core 仅通过 `SchemxComponentPropsDefinition`
 * 接收它的声明合并结果。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @typeParam TValue - 当前字段值类型。
 */
export interface SchemxVueBaseComponentProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
> extends CoreSchemxBaseComponentProps<TValues> {
  /**
   * Vue Renderer 内容区域对齐方式。
   */
  align?: "left" | "center" | "right"

  /**
   * Vue v-model 更新事件。
   */
  "onUpdate:value"?: (value: TValue) => void

  /**
   * 当前字段值。
   */
  value?: TValue

  /**
   * Renderer 值变化处理。
   */
  onChange?: (value: TValue) => void

  /**
   * Renderer 失焦处理。
   */
  onBlur?: (value: TValue) => void
}

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

/**
 * 字段区域 Slot 共用的上下文参数。
 */
export interface SchemxFieldSlotProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 当前字段完整的已解析 ViewSchema。
   */
  schema: SchemxViewFieldSchema<TValues> & { readonly name: TName }
  /**
   * 当前 Renderer 的完整运行时 Props。
   */
  componentProps: SchemxComponentProps<TValues>
  /**
   * 当前字段值。
   */
  value: FieldValue<TValues, TName> | undefined
  /**
   * 当前字段控制器。
   */
  field: FieldInstance<TValues>
  /**
   * 当前表单实例。
   */
  form: SchemxInstance<TValues>
}

/**
 * 字段内容 Slot 额外获得的默认 Renderer VNode。
 */
export interface SchemxFieldContentSlotProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends SchemxFieldSlotProps<TValues, TName> {
  /**
   * 默认 Renderer 生成的 VNode，可用于包裹或替换控件内容。
   */
  columnElement: VNodeChild
}

/**
 * 字段错误 Slot 额外获得的当前错误列表。
 */
export interface SchemxFieldErrorSlotProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends SchemxFieldSlotProps<TValues, TName> {
  /** 当前字段的全部错误信息。 */
  errors: readonly string[]
}

/**
 * Field 单个动态插槽可接收的参数。
 *
 * 字段整体、Label、Before、After 使用基础参数；Content 和 Error 分别增加
 * `columnElement` 与 `errors`。
 */
export type SchemxFieldSlotValue<TValues extends Values = Values> =
  | SchemxFieldSlotProps<TValues>
  | SchemxFieldContentSlotProps<TValues>
  | SchemxFieldErrorSlotProps<TValues>

/**
 * Field 的 SlotsType 参数映射。
 *
 * Key 是运行时 Schema 生成的 `{name}`、`{name}Label`、`{name}Before`、
 * `{name}Content`、`{name}After` 或 `{name}Error`。Value 是 Vue 传给对应插槽的
 * Props 对象，不是插槽函数。`{name}:{slotName}` 子 Renderer 插槽由具体
 * Renderer 定义，调用方可在自己的组件类型中进一步收窄。
 */
export interface SchemxFieldSlots<TValues extends Values = Values> {
  [slotName: string]: SchemxFieldSlotValue<TValues>
}

/**
 * 分组区域 Slot 共用的上下文参数。
 */
export interface SchemxGroupSlotProps<TValues extends Values = Values> {
  /**
   * 当前分组完整的已解析 ViewSchema。
   */
  schema: SchemxViewGroupSchema<TValues>
  /**
   * 当前是否收起。
   */
  collapsed: boolean
  /**
   * 当前分组是否可收起。
   */
  collapsible: boolean
  /**
   * 当前分组是否禁用。
   */
  disabled: boolean
  /**
   * 当前分组是否只读。
   */
  readonly: boolean
  /**
   * 切换分组收起状态。禁用或不可折叠时无效果。
   */
  toggle: () => void
}

/**
 * Group 的 SlotsType 参数映射。
 *
 * Group 的 Header、Label 和 Content 插槽名称均由运行时 schema key 生成，
 * 三类插槽共享同一个 Props 契约。
 */
export interface SchemxGroupSlots<TValues extends Values = Values> {
  [slotName: string]: SchemxGroupSlotProps<TValues>
}
