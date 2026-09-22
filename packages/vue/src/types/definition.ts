/**
 * Vue 对 Core Schema、Renderer Props 与展示配置的声明合并入口。
 *
 * @module types
 */

import type { StyleValue } from "vue"

import type { SchemxIconComponent, SchemxIconValue } from "./icon"
import type {
  SchemxColComponent,
  SchemxColConfig,
  SchemxLayout,
  SchemxRowComponent,
  SchemxRowConfig,
} from "./layout"
import type {
  FieldValue,
  SchemxConditionFn,
  Values,
} from "@schemx/core"

/**
 * 保持 Vue 层 Core 声明合并文件出现在发布的类型入口中。
 *
 * 该类型没有运行时含义，仅用于让生成的 `index.d.ts` 保留对本模块的类型引用。
 */
export type SchemxVueTypeAugmentations = never

declare module "@schemx/core" {
  /**
   * Vue Field 的展示与事件扩展。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxFieldDefinition<TValues extends Values = Values> {
    /**
     * 字段自身的静态 Col 配置。
     */
    col?: SchemxColConfig<TValues>

    /**
     * 旧版字段静态布局配置。
     *
     * @deprecated 请改用 {@link SchemxColConfig} 与 `col` 字段。
     */
    layout?: SchemxLayout<TValues>

    /**
     * 追加到 Field 外层容器元素上的自定义 CSS 类名。
     */
    class?: string

    /**
     * 应用到 Field 外层容器元素上的自定义内联样式。
     */
    style?: StyleValue

    /**
     * 是否显示必填视觉标记。
     */
    showRequiredMark?: boolean

    /**
     * 标签图标名称或 Vue 图标组件。
     */
    labelIcon?: SchemxIconValue

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
    labelWidth?: string | number

    /**
     * 内容区域对齐方式。
     */
    contentAlign?: "left" | "center" | "right"

    /**
     * 错误区域对齐方式。
     */
    errorAlign?: "left" | "center" | "right"

    /**
     * 是否在标签后显示冒号。
     */
    colon?: boolean

    /**
     * 是否在字段外层容器显示底部边框。
     */
    bordered?: boolean
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
     * Group 子级使用的 Row 配置。
     */
    row?: SchemxRowConfig

    /**
     * 旧版 Group 外层布局配置。
     *
     * @deprecated 请改用 {@link SchemxRowConfig} 与 `row` 字段。
     */
    layout?: SchemxLayout

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
     *
     * @param collapsed - 用户操作后请求的折叠状态。
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
     * 每个 Dynamic item 使用的 Row 配置。
     */
    row?: SchemxRowConfig

    /**
     * 旧版 Dynamic 外层布局配置。
     *
     * @deprecated 请改用 {@link SchemxRowConfig} 与 `row` 字段。
     */
    layout?: SchemxLayout
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
   * Vue 表单配置字段展示默认值扩展。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface SchemxConfigDefinition<TValues extends Values = Values> {
    /**
     * 当前 App、Provider 或 Form 的默认 Row 配置。
     */
    readonly row?: SchemxRowConfig

    /**
     * 当前 App、Provider 或 Form 使用的 Col 实现。
     */
    readonly colComponent?: SchemxColComponent

    /**
     * 当前 App、Provider 或 Form 使用的 Row 实现。
     */
    readonly rowComponent?: SchemxRowComponent

    /**
     * 当前 App、Provider 或 Form 使用的 Icon Adapter。
     */
    readonly iconComponent?: SchemxIconComponent
  }

  /**
   * Vue 表单级字段展示默认值扩展。
   */
  interface SchemxSchemaConfigDefinition {
    /**
     * Form、Group 和 Dynamic 使用的默认 Row 配置。
     */
    row?: SchemxRowConfig

    /**
     * 字段默认 Col 配置。
     */
    col?: SchemxColConfig

    /**
     * 旧版字段默认布局配置。
     *
     * @deprecated 请改用 {@link SchemxColConfig} 与 `col` 字段。
     */
    layout?: SchemxLayout

    /**
     * 表单级标签图标默认值。
     */
    labelIcon?: SchemxIconValue

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
    labelWidth?: string | number

    /**
     * 表单级内容对齐默认值。
     */
    contentAlign?: "left" | "center" | "right"

    /**
     * 表单级校验错误对齐默认值。
     */
    errorAlign?: "left" | "center" | "right"

    /**
     * 表单级冒号默认值。
     */
    colon?: boolean

    /**
     * 表单级必填标记默认值。
     */
    showRequiredMark?: boolean

    /**
     * 表单级字段底部边框默认值。
     */
    bordered?: boolean
  }

  /**
   * Vue Renderer 的公共 Props 扩展。
   */
  interface SchemxComponentPropsDefinition<TValues extends Values = Values> {
    /**
     * Renderer 内容对齐方式。
     *
     * @deprecated 对齐配置应由 Renderer 专属 Props 定义，见 {@link SchemxRendererDefinition}；兼容期间仍接受。
     */
    align?: "left" | "center" | "right"

    /**
     * Vue v-model 更新事件。
     *
     * @param value - Renderer 提交的最新字段值。
     */
    "onUpdate:value"?: (value: FieldValue<TValues>) => void

    /** Renderer 当前接收的字段值。 */
    value?: FieldValue<TValues>

    /**
     * Renderer 值变化处理。
     *
     * @param value - 用户输入或选择的最新字段值。
     */
    onChange?: (value: FieldValue<TValues>) => void

    /**
     * Renderer 失焦处理。
     *
     * @param value - 失焦时的当前字段值。
     */
    onBlur?: (value: FieldValue<TValues>) => void
  }
}
