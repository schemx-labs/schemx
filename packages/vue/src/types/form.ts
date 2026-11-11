/**
 * Vue 表单组件与表单操作的公开类型。
 *
 * @module types/form
 */

import type { ClassValue, StyleValue } from "vue"

import type {
  SchemxColComponent,
  SchemxColConfig,
  SchemxIconComponent,
  SchemxIconValue,
  SchemxLayout,
  SchemxRowComponent,
  SchemxRowConfig,
} from "./index"
import type { SchemxButtonComponent, SchemxButtonProps } from "../components/Button"
import type {
  CreateFormOptions,
  SchemxInstance,
  SchemxSchemaConfig,
  Values,
} from "@schemx/core"

/**
 * 字段定位完成后的高亮配置。
 */
export interface ScrollToFieldHighlightOptions {
  /**
   * 定位提示的视觉类型，默认 default；不改变字段校验状态。
   */
  type?: "default" | "warning" | "error"

  /**
   * 高亮持续时间，单位毫秒；默认 1500。
   * 0 持续显示，直到操作目标区域、发起新定位或目标失效。
   * 非有限数或负数使用默认值。
   */
  duration?: number
}

/**
 * 配置 `scrollToField` 的滚动行为、对齐方式与定位高亮。
 */
export interface ScrollToFieldOptions {
  /**
   * 滚动行为；默认 `smooth`，`auto` 使用浏览器默认行为。
   */
  behavior?: "auto" | "smooth"
  /**
   * 字段在滚动容器中的垂直对齐方式；默认 `center`。
   */
  block?: "start" | "center" | "end" | "nearest"
  /**
   * 字段在滚动容器中的水平对齐方式。
   */
  inline?: "start" | "center" | "end" | "nearest"
  /**
   * 滚动完成后高亮目标字段；默认 true。点击或编辑目标区域可提前关闭提示。
   */
  highlight?: boolean | ScrollToFieldHighlightOptions
}

/**
 * 内置表单操作按钮的显示配置。
 *
 * `buttonProps` 使用选定 UI 库的配置；原生按钮行为和点击事件由表单管理。
 */
export interface SchemxFormActionConfig {
  /**
   * 按钮展示文本；未提供时使用操作的默认文案。
   */
  text?: string
  /**
   * 透传给当前 UI 按钮的属性；type 表示外观类型。
   */
  buttonProps?: SchemxActionButtonProps
}

/**
 * 移除操作区管理的原生行为与点击事件。
 */
export type SchemxActionButtonProps = Omit<SchemxButtonProps, "nativeType" | "onClick">

/**
 * 内置表单操作按钮的启用配置。
 *
 * `true` 使用默认按钮配置，`false` 隐藏按钮，对象形式用于覆盖按钮文案和属性。
 */
export type SchemxFormAction = boolean | SchemxFormActionConfig

/**
 * schemx 表单组件 Props。
 *
 * 字段默认值通过平铺 Props 暴露，并在组件边界转换为嵌套配置；Core 的回调、生命周期、性能和
 * Renderer 配置则通过继承的类型继续提供。
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxFormProps<TValues extends Values = Values>
  extends
    Omit<CreateFormOptions<TValues>, "schemaConfig" | "submitter" | "resetter">,
    Omit<SchemxSchemaConfig<TValues>, "class"> {
  /**
   * 标签图标；显式声明以供 SFC 编译器生成运行时 Props。
   */
  labelIcon?: SchemxIconValue
  /**
   * 标签文本对齐。
   */
  labelAlign?: "left" | "center" | "right"
  /**
   * 标签位置。
   */
  labelPosition?: "left" | "top" | "right"
  /**
   * 标签宽度。
   */
  labelWidth?: string | number
  /**
   * 内容区域对齐。
   */
  contentAlign?: "left" | "center" | "right"
  /**
   * 是否显示标签冒号；省略时继承框架默认值。
   */
  colon?: boolean
  /**
   * 是否显示必填视觉标记；省略时跟随有效 required。
   */
  showRequiredMark?: boolean
  /**
   * 当前 Form 使用的 Col 组件实现。
   */
  colComponent?: SchemxColComponent
  /**
   * 当前 Form 使用的 Row 组件实现。
   */
  rowComponent?: SchemxRowComponent
  /**
   * 当前 Form 使用的 Button 组件实现。
   */
  buttonComponent?: SchemxButtonComponent
  /**
   * 当前 Form 使用的图标组件实现。
   */
  iconComponent?: SchemxIconComponent
  /**
   * Vue 受控模式下的表单值。
   */
  modelValue?: TValues
  /**
   * 外部传入的表单实例；传入后由组件复用该实例。
   */
  form?: SchemxInstance<TValues>
  /**
   * 平铺的 Vue 配置显式声明，供 SFC 编译器生成运行时 Props。
   */
  row?: SchemxRowConfig<TValues>
  /**
   * 字段默认 Col 配置。
   */
  col?: SchemxColConfig<TValues>
  /**
   * 旧版字段默认布局；请改用 col。
   */
  layout?: SchemxLayout<TValues>
  /**
   * 校验错误区域的默认对齐方式。
   */
  errorAlign?: "left" | "center" | "right"
  /**
   * 是否显示字段底部边框。
   */
  bordered?: boolean

  /**
   * 覆盖内置操作区展示的提交状态；不改变 Core 的真实提交状态。
   */
  loading?: boolean

  /**
   * 添加到 Form 根元素的自定义 CSS 类名。
   */
  class?: ClassValue

  /**
   * 应用到 Form 根元素的自定义内联样式。
   */
  style?: StyleValue

  /**
   * 操作区的列布局配置；省略时使用满宽列，不继承字段默认 `col`。
   */
  actionCol?: SchemxColConfig<TValues>

  /**
   * 提交按钮配置；默认显示，设为 false 时隐藏。
   */
  submitter?: SchemxFormAction

  /**
   * 重置按钮配置；默认显示，设为 false 时隐藏。
   */
  resetter?: SchemxFormAction
}
