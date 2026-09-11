/**
 * Renderer Props 类型定义。
 *
 * 定义所有 Renderer 共用的 Core Props、适配层扩展点和按 Renderer 类型映射的 Props。
 *
 * @module types/componentProps
 */

import type { SchemxBase } from "./field"
import type { FieldValue, NamePath, Values } from "./form"
import type { SchemxInstance } from "./instance"
import type { SchemxRendererDefinition, SchemxRendererKey } from "./renderer"

/** Field 组件的展示 Props；由 Vue 等 UI 适配层消费。 */
export type SchemxFormItemProps<TValues extends Values = Values> = Omit<
  SchemxBase<TValues>,
  "componentProps"
>

/**
 * Core 自身使用的轻量 Renderer 公共 Props。
 *
 * UI 适配层可通过 `SchemxComponentPropsDefinition` 增加框架专属属性；旧版
 * `SchemxBaseComponentProps` 则继续保留完整兼容形态。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxCoreBaseComponentProps<TValues extends Values = Values> {
  /**
   * 是否只读
   */
  readonly?: boolean
  /**
   * 是否禁用
   */
  disabled?: boolean
  /**
   * 占位符
   */
  placeholder?: string
  /**
   * 只读并且值为空时的占位符
   */
  readonlyPlaceholder?: string
  /**
   * Field 组件的展示 Props；schema 属性名保留 `formItemProps`。
   */
  formItemProps?: SchemxFormItemProps<TValues>
  /**
   * Form 表单实例方法
   */
  formInstance?: SchemxInstance<TValues>
}

/**
 * 渲染器组件通用扩展属性
 *
 * 所有渲染器组件都会自动注入的公共 props，
 * 与 {@link SchemxRendererDefinition} 中各组件的专属 Props 交叉后，
 * 作为 `componentProps` 的最终类型。
 *
 * `TName` 和 `TValue` 以及 Vue 相关属性保留用于兼容旧版 Renderer 类型；新适配层
 * 应使用自己的公共 Props 类型，例如 `@schemx/vue` 的
 * `SchemxVueBaseComponentProps`。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 兼容旧版的字段路径类型。
 * @typeParam TValue - 兼容旧版的字段值类型。
 */
export interface SchemxBaseComponentProps<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
  TValue = FieldValue<TValues, TName>,
> extends SchemxCoreBaseComponentProps<TValues> {
  /**
   * 内容区域对齐方式。
   *
   * @deprecated 请从对应 UI 适配层使用公共 Renderer Props 类型。
   */
  align?: "left" | "center" | "right"

  /**
   * 当前字段值。
   *
   * @deprecated 请从对应 UI 适配层使用公共 Renderer Props 类型。
   */
  value?: TValue

  /**
   * 字段值更新回调。
   *
   * @deprecated 请从对应 UI 适配层使用公共 Renderer Props 类型。
   */
  "onUpdate:value"?: (value: TValue) => void

  /**
   * 值变化回调。
   *
   * @deprecated 请从对应 UI 适配层使用公共 Renderer Props 类型。
   */
  onChange?: (value: TValue) => void

  /**
   * 失焦回调。
   *
   * @deprecated 请从对应 UI 适配层使用公共 Renderer Props 类型。
   */
  onBlur?: (value: TValue) => void
}

/**
 * Renderer 公共 Props 的适配层扩展接口。
 *
 * Vue 等适配层通过声明合并增加框架专属 Props。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SchemxComponentPropsDefinition<TValues extends Values = Values> {}

/** 按 Renderer 类型解析后的完整 Props。 */
export type SchemxComponentProps<
  TValues extends Values = Values,
  TKey extends string = SchemxRendererKey<TValues>,
> = SchemxBaseComponentProps<TValues> &
  SchemxComponentPropsDefinition<TValues> &
  ([Extract<keyof SchemxRendererDefinition<TValues>, string>] extends [never]
    ? unknown
    : TKey extends keyof SchemxRendererDefinition<TValues>
      ? SchemxRendererDefinition<TValues>[TKey]
      : unknown)

/**
 * 按 Renderer 类型配置的静态默认 Props。
 *
 * Runtime 注入的 value、事件、formInstance 和 formItemProps 不属于默认 Props。
 */
export type SchemxRendererPropsMap<TValues extends Values = Values> = Partial<{
  [TKey in SchemxRendererKey<TValues>]: Partial<
    Omit<
      SchemxComponentProps<TValues, TKey>,
      "value" | "onUpdate:value" | "formInstance" | "formItemProps"
    >
  >
}>
