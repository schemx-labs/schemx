/**
 * 字段级默认配置。
 *
 * 各字段的静态默认值，字段未显式设置时使用。
 * 部分属性可由工厂默认配置或当前 Form 的实例配置覆盖。
 */
export const defaultSchemxConfig = Object.freeze({
  /**
   * 外层容器元素上的自定义 CSS 类名。
   */
  class: "",

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
   * 校验触发时机
   *
   * 支持单个或多个触发时机组合，如 `'change'`、`'blur'`、`['change', 'blur']`。
   * 未设置时继承当前 Form 的 `schemaConfig.validationTrigger` 配置。
   */
  validationTrigger: "blur",
} as const satisfies Record<SchemxConfigKey, unknown>)

/**
 * `defaultSchemxConfig` 的键集合，用于类型安全的配置访问。
 * 显式字面量键供 Vue SFC 解析；默认配置通过 satisfies 校验键集合完整性。
 */
export type SchemxConfigKey =
  "required" | "readonly" | "disabled" | "visible" | "validationTrigger" | "class"

/**
 * `defaultSchemxConfig` 的所有键数组。
 *
 * 运行时需遍历默认配置字段时使用。
 */
export const defaultSchemxConfigKeys = Object.keys(
  defaultSchemxConfig
) as SchemxConfigKey[]
