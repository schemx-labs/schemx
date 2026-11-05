/**
 * Renderer Props 类型定义。
 *
 * 定义所有 Renderer 共用的 Core Props、适配层扩展点和按 Renderer 类型映射的 Props。
 *
 * @module types/componentProps
 */

import type {
  SchemxBase,
  SchemxInstance,
  SchemxRendererDefinition,
  SchemxRendererKey,
  Values,
} from "./index"

/** Field 组件的展示 Props；由 Vue 等 UI 适配层消费。 */
export type SchemxFormItemProps<TValues extends Values = Values> = Omit<
  SchemxBase<TValues>,
  "componentProps"
>

/**
 * Core 自身使用的轻量 Renderer 公共 Props。
 *
 * 框架适配层（Vue、React、...）通过 {@link SchemxComponentPropsDefinition} 增加值和事件等框架专属属性。
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
 * 框架适配层（Vue、React、...）通过 {@link SchemxComponentPropsDefinition} 声明公共 Props。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxBaseComponentProps<TValues extends Values = Values>
  extends
    SchemxCoreBaseComponentProps<TValues>,
    SchemxComponentPropsDefinition<TValues> {}

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
> = [Extract<keyof SchemxRendererDefinition<TValues>, string>] extends [never]
  ? SchemxBaseComponentProps<TValues>
  : TKey extends keyof SchemxRendererDefinition<TValues>
    ? SchemxBaseComponentProps<TValues> & SchemxRendererDefinition<TValues>[TKey]
    : SchemxBaseComponentProps<TValues>

/**
 * 按 Renderer 类型配置的静态默认 Props。
 *
 * 渲染阶段注入的 value、事件、formInstance 和 formItemProps 不属于默认 Props。
 */
export type SchemxRendererPropsMap<TValues extends Values = Values> = Partial<{
  [TKey in SchemxRendererKey<TValues>]: Partial<
    Omit<
      SchemxComponentProps<TValues, TKey>,
      "value" | "onUpdate:value" | "formInstance" | "formItemProps"
    >
  >
}>
