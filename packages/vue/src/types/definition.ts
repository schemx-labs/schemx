/**
 * Vue 对 Core Schema、Renderer Props 与展示配置的声明合并入口。
 *
 * @module types
 */

import type { StyleValue } from "vue"

import type { SchemxVueBaseComponentProps } from "./field"
import type { SchemxVueLayout } from "./layout"
import type { SchemxConditionFn, Values } from "@schemx/core"

declare module "@schemx/core" {
  /**
   * Vue Field 的展示与事件扩展。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxFieldDefinition<TValues extends Values = Values> {
    /**
     * 追加到 Field 外层容器元素上的自定义 CSS 类名。
     */
    class?: string

    /**
     * 应用到 Field 外层容器元素上的自定义内联样式。
     */
    style?: StyleValue

    /**
     * Vue Field 使用的布局元数据。
     */
    layout?: SchemxVueLayout

    /**
     * 是否显示必填视觉标记。
     */
    showRequiredMark?: boolean

    /**
     * 标签图标标识；兼容阶段保持字符串类型。
     */
    labelIcon?: string

    /**
     * 标签对齐方式。
     */
    labelAlign?: "left" | "center" | "right"

    /**
     * 标签位置。
     */
    labelPosition?: "left" | "top" | "right"

    /**
     * 标签宽度。
     */
    labelWidth?: string

    /**
     * 内容区域对齐方式。
     */
    contentAlign?: "left" | "center" | "right"

    /**
     * 是否在标签后显示冒号。
     */
    colon?: boolean
  }

  /**
   * Vue Group 的展示与折叠扩展。
   */
  interface SchemxGroupFieldDefinition {
    /**
     * 追加到 Group 外层容器元素上的自定义 CSS 类名。
     */
    class?: string

    /**
     * 应用到 Group 外层容器元素上的自定义内联样式。
     */
    style?: StyleValue

    /**
     * Group 标题。
     */
    label?: string

    /**
     * Group 使用的布局元数据。
     */
    layout?: SchemxVueLayout

    /**
     * 是否允许折叠。
     */
    collapsible?: boolean

    /**
     * 非受控模式下的初始折叠状态。
     */
    defaultCollapsed?: boolean

    /**
     * 受控折叠状态。
     */
    collapsed?: boolean

    /**
     * 折叠状态变化回调。
     */
    onCollapsedChange?: (collapsed: boolean) => void

    /**
     * 折叠时是否卸载后代 Renderer。
     */
    destroyOnCollapse?: boolean
  }

  /**
   * Vue Dynamic 的展示扩展。
   */
  interface SchemxDynamicDefinition {
    /**
     * Dynamic 展示名称。
     */
    label?: string

    /**
     * Dynamic 使用的布局元数据。
     */
    layout?: SchemxVueLayout
  }

  /**
   * Vue Field 依赖配置的动态展示扩展。
   */
  interface SchemxFieldDependenciesDefinition<TValues extends Values = Values> {
    /**
     * 动态必填视觉标记。
     */
    showRequiredMark?: SchemxConditionFn<TValues, boolean>
  }

  /**
   * Vue 表单级字段展示默认值扩展。
   */
  interface SchemxSchemaConfigDefinition {
    /**
     * 表单级标签图标默认值。
     */
    labelIcon?: string

    /**
     * 表单级标签对齐默认值。
     */
    labelAlign?: "left" | "center" | "right"

    /**
     * 表单级标签位置默认值。
     */
    labelPosition?: "left" | "top" | "right"

    /**
     * 表单级标签宽度默认值。
     */
    labelWidth?: string

    /**
     * 表单级内容对齐默认值。
     */
    contentAlign?: "left" | "center" | "right"

    /**
     * 表单级冒号默认值。
     */
    colon?: boolean

    /**
     * 表单级必填标记默认值。
     */
    showRequiredMark?: boolean
  }

  /**
   * Vue Renderer 的公共 Props 扩展。
   */
  interface SchemxComponentPropsDefinition<
    TValues extends Values = Values,
  > extends SchemxVueBaseComponentProps<TValues> {}
}
