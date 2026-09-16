/**
 * Vue 适配层的字段展示默认值。
 *
 * Core 仍暂时保留同名默认配置作为兼容来源；新的 Vue 渲染路径优先使用这里的配置。
 */
export const defaultVueSchemaConfig = Object.freeze({
  /**
   * 表单级标签图标默认值。
   */
  labelIcon: "",
  /**
   * 表单级标签对齐默认值。
   */
  labelAlign: "left",
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
  contentAlign: "right",
  /**
   * 表单级标签冒号默认值。
   */
  colon: true,
  /**
   * 表单级必填标记默认值。
   */
  showRequiredMark: undefined as boolean | undefined,

  /**
   * 是否在 field schema 后显示底部边框。
   */
  bordered: true,
} as const)

/**
 * Vue 展示默认配置的键集合。
 */
export const defaultVueSchemaConfigKeys = Object.keys(
  defaultVueSchemaConfig
) as (keyof typeof defaultVueSchemaConfig)[]
