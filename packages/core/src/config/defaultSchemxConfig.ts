/**
 * 字段级默认配置。
 *
 * 各字段的静态默认值，字段未显式设置时使用。
 * 部分属性可由全局 Schemx 配置或当前 Form 的实例配置覆盖。
 */
export const defaultSchemxConfig = Object.freeze({
  /**
   * 是否启用必填校验（静态默认值）
   *
   * `showRequiredMark` 独立控制必填视觉标记；未显式设置时，运行时标记会跟随有效的
   * `required` 值。
   */
  required: false,

  /**
   * 是否只读（静态默认值）
   *
   * 未设置时继承当前 Form 的 `schemaConfig.readonly` 配置。
   */
  readonly: false,

  /**
   * 是否禁用（静态默认值）
   *
   * 未设置时继承当前 Form 的 `schemaConfig.disabled` 配置。
   */
  disabled: false,

  /**
   * 是否可见（静态默认值）
   *
   * 不可见时字段不渲染，同时会清除校验规则和错误信息。
   */
  visible: true,

  /**
   * 标签图标
   *
   * 显示在 label 文本旁的图标标识。
   */
  labelIcon: "",

  /**
   * 标签对齐方式
   *
   * 未设置时继承当前 Form 的 `schemaConfig.labelAlign` 配置。
   */
  labelAlign: "left",

  /**
   * 标签位置
   *
   * 未设置时继承当前 Form 的 `schemaConfig.labelPosition` 配置。
   */
  labelPosition: "left",

  /**
   * 标签宽度
   *
   * 未设置时继承当前 Form 的 `schemaConfig.labelWidth` 配置。
   */
  labelWidth: "auto",

  /**
   * 内容对齐方式
   *
   * 未设置时继承当前 Form 的 `schemaConfig.contentAlign` 配置。
   */
  contentAlign: "right",

  /**
   * 校验触发时机
   *
   * 支持单个或多个触发时机组合，如 `'change'`、`'blur'`、`['change', 'blur']`。
   * 未设置时继承当前 Form 的 `schemaConfig.validationTrigger` 配置。
   */
  validationTrigger: "blur",

  /**
   * 是否在标签后显示冒号
   *
   * 未设置时继承当前 Form 的 `schemaConfig.colon` 配置。
   */
  colon: true,

  /**
   * 是否显示必填视觉标记（静态默认值）
   *
   * 未设置时运行时回退到 `Boolean(required)`（跟随必填状态）。
   * 全局或字段显式设置后覆盖该回退行为。
   */
  showRequiredMark: undefined as boolean | undefined,
} as const)

/**
 * `defaultSchemxConfig` 的键集合，用于类型安全的配置访问。
 */
export type SchemxConfigKey = keyof typeof defaultSchemxConfig

/**
 * `defaultSchemxConfig` 的所有键数组。
 *
 * 运行时需遍历默认配置字段时使用。
 */
export const defaultSchemxConfigKeys = Object.keys(
  defaultSchemxConfig
) as SchemxConfigKey[]

/**
 * 运行时需遍历 排除 默认配置字段时使用。
 */
export const excludeSchemxConfigKeys = [
  "key",
  "name",
  "label",
  "componentType",
  "dependencies",
  "componentProps",
  "placeholder",
  "readonlyPlaceholder",
  "initialValue",
  "rules",
  "onChange",
  "onBlur",
  "children",
  "to",
  "renderer",
] as const

/**
 * 需要排除的 Schema 配置字段名称。
 */
export type ExcludeSchemxConfigKeys = (typeof excludeSchemxConfigKeys)[number]

/**
 * @deprecated 请使用 `defaultSchemxConfig`。
 */
export const schemaConfig = defaultSchemxConfig

/**
 * @deprecated 请使用 `SchemxConfigKey`。
 */
export type SchemaConfigKey = SchemxConfigKey

/**
 * @deprecated 请使用 `defaultSchemxConfigKeys`。
 */
export const schemaConfigKeys = defaultSchemxConfigKeys

/**
 * @deprecated 请使用 `excludeSchemxConfigKeys`。
 */
export const excludeSchemaConfigKeys = excludeSchemxConfigKeys

/**
 * @deprecated 请使用 `ExcludeSchemxConfigKeys`。
 */
export type ExcludeSchemaConfigKeys = ExcludeSchemxConfigKeys
