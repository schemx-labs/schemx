import { SchemxSchemaConfig } from "@schemx/core"

/**
 * Vue 适配层的字段展示默认值。
 *
 * Vue 层拥有字段展示与布局默认值；Core 只处理框架无关的字段状态和校验默认值。
 */
export const defaultConfig = Object.freeze({
  /**
   * 表单级标签图标默认值。
   */
  labelIcon: "",
  /**
   * 表单级标签对齐默认值。
   */
  labelAlign: "right",
  /**
   * 表单级标签位置默认值。
   */
  labelPosition: "left",
  /**
   * 表单级标签宽度默认值。
   */
  labelWidth: "auto",
  /**
   * 表单级内容对齐默认值。
   */
  contentAlign: "left",
  /**
   * 表单级校验错误对齐默认值。
   */
  errorAlign: "left",
  /**
   * 表单级标签冒号默认值。
   */
  colon: true,
  /**
   * 表单级必填标记默认值。
   */
  showRequiredMark: undefined as boolean | undefined,

  /**
   * 字段默认 Col 配置。
   */
  col: { span: 24 },

  /**
   * 旧版字段默认布局配置。
   *
   * @deprecated 请改用 {@link import("../types/layout").SchemxColConfig} 与 `col` 字段。
   */
  layout: { span: 24 },

  /**
   * 是否在 field schema 后显示底部边框。
   */
  bordered: true,

  visible: true,

  validationTrigger: ["blur", "change"],
} as const) as unknown as SchemxSchemaConfig

/**
 * Vue 展示默认配置的键集合。
 */
export const defaultConfigKeys = Object.keys(
  defaultConfig
) as (keyof typeof defaultConfig)[]
/**
 * 组件平铺 Props 转换为 Schema 默认值时使用的键；Row 同时用于根级和容器布局。
 */
export const vueSchemaConfigKeys = [
  "required",
  "readonly",
  "disabled",
  "visible",
  "validationTrigger",
  "labelIcon",
  "labelAlign",
  "labelPosition",
  "labelWidth",
  "contentAlign",
  "errorAlign",
  "colon",
  "showRequiredMark",
  "col",
  "layout",
  "bordered",
  "row",
  "actionCol",
] as const
