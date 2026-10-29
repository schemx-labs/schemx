/**
 * Vue 字段控制器、Renderer Props 与插槽上下文类型。
 *
 * @module types/field
 */

import type { ComputedRef, VNodeChild, WritableComputedRef } from "vue"

import type {
  DeepReadonly,
  FieldRef,
  FieldRefState,
  FieldRules,
  FieldValue,
  NamePath,
  SchemxBaseComponentProps,
  SchemxComponentProps,
  SchemxInstance,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  ValidationResult,
  Values,
} from "@schemx/core"

/**
 * Vue Renderer 的旧版公共 Props 类型。
 *
 * @deprecated 请改用 {@link SchemxBaseComponentProps}。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @typeParam TValue - 当前字段值类型。
 */
export type SchemxVueBaseComponentProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
> = SchemxBaseComponentProps<TValues, TName, TValue>

/**
 * Vue 层字段控制器实例
 *
 * 复用 Core 字段命令，将 Signal 驱动的只读状态桥接为 Vue Ref，
 * 供模板、computed、watchEffect 等响应式上下文直接使用。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 初始字段路径，用于保留值类型。
 */
export interface FieldInstance<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 字段引用，所有操作都经由 Form instance。
   */
  readonly ref: FieldRef<TValues, TName>
  /**
   * 兼容只读状态，状态实际由 Form 持有。
   */
  readonly state: FieldRefState<TValues, TName>
  /**
   * 用户修改直接委托 Form 的交互入口。
   */
  change(
    value: FieldValue<TValues, TName> | undefined
  ): Promise<ValidationResult<TValues> | undefined>
  /**
   * 用户失焦直接委托 Form。
   */
  blur(): Promise<ValidationResult<TValues> | undefined>
  /**
   * 设置当前字段值。
   *
   * @param value - 新字段值。
   */
  setValue: (value: FieldValue<TValues, TName> | undefined) => void

  /**
   * 获取字段初始值。
   *
   * @returns 当前字段的初始值；未设置时返回 undefined。
   */
  getInitialValue: () => FieldValue<TValues, TName> | undefined

  /**
   * 设置字段初始值。
   *
   * @param value - 新初始值。
   */
  setInitialValue: (value: FieldValue<TValues, TName>) => void

  /**
   * 获取表单当前值。
   *
   * 在 effect 中调用时，读取过程会自动追踪字段变化。
   *
   * @returns 当前表单值对象。
   */
  getValues: () => TValues

  /**
   * 获取表单字段快照。
   *
   * @returns 当前表单值快照。
   */
  getSnapshot: () => FieldValue<TValues, TName> | undefined

  /**
   * 获取表单全量快照。
   *
   * @returns 当前表单值快照。
   */
  getSnapshots: () => TValues

  /**
   * 获取当前字段错误信息。
   *
   * @returns 错误信息的只读快照；没有错误时返回空数组。
   */
  getErrors: () => readonly string[]

  /**
   * 设置当前字段错误信息。
   *
   * @param errors - 用于替换当前错误状态的消息数组。
   */
  setErrors: (errors: readonly string[]) => void

  /**
   * 清除当前字段错误信息。
   */
  clearErrors: () => void

  /**
   * 替换当前字段的全部校验规则。
   *
   * @param rules - 校验规则或规则数组。
   *
   * @example
   * ```ts
   * field.setRules({
   *   validate: (value) => value
   *     ? { valid: true }
   *     : { valid: false, issues: [{ message: "不能为空" }] },
   * })
   * ```
   */
  setRules: (rules: FieldRules<TValues, TName>) => void

  /**
   * 注销当前字段校验规则。
   */
  removeRules: () => void

  /**
   * 设置字段交互状态。
   *
   * 传入路径设置字段修改状态。
   */
  setTouched(value: boolean): void

  /**
   * 检查当前字段是否已被触摸。
   *
   * @returns 是否已被触摸。
   */
  isTouched: () => boolean

  /**
   * 设置当前字段操作中状态。
   *
   * @param pending - 是否处于操作中。
   * @param message - 可选的操作中提示信息。
   */
  setPending: (pending: boolean, message?: string | string[]) => void

  /**
   * 检查当前字段是否处于操作中。
   *
   * @returns 是否处于操作中。
   */
  isPending: () => boolean

  /**
   * 重置当前字段到初始值。
   */
  reset: () => void

  /**
   * 校验当前字段。
   *
   * @returns 当前字段校验结果。
   */
  validate: () => Promise<ValidationResult<TValues, TName>>

  /**
   * 创建 reactive effect
   *
   * 直接透传 form.effect，在回调中访问 getValue / getErrors / isPending 时
   * 自动追踪对应 reactive 依赖，依赖变化时 effect 自动重新执行。
   *
   * @param fn - effect 回调函数
   * @returns dispose 函数，取消 effect
   *
   * @example
   * ```ts
   * const dispose = field.effect(() => {
   *   console.log('value:', field.getValue())
   * })
   * dispose()
   * ```
   */
  effect: (fn: () => void) => () => void
  /**
   * 当前字段路径。
   */
  readonly name: NamePath<TValues> | undefined
  /**
   * 当前字段的只读值；整体赋值通过 Core setValue 提交。
   */
  readonly value: WritableComputedRef<
    DeepReadonly<FieldValue<TValues, TName>> | undefined
  >
  /**
   * 读取共享字段投影中的深层只读值。
   */
  getValue(): DeepReadonly<FieldValue<TValues, TName>> | undefined
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
  field: FieldInstance<TValues, TName>
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
