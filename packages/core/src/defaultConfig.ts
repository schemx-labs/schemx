export const defaultConfig = {
  /**
   * 是否展示必填的 * 号（静态默认值）
   *
   * 控制必填标记（红色星号）的显示。
   * 若未设置，会根据 `rules` 中的校验规则自动推断。
   */
  required: false,

  /**
   * 是否只读（静态默认值）
   *
   * 未设置时继承 FormContext 的全局 `readonly` 配置。
   */
  readonly: false,

  /**
   * 是否禁用（静态默认值）
   *
   * 未设置时继承 FormContext 的全局 `disabled` 配置。
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
   * 未设置时继承 FormContext 的全局 `labelAlign` 配置。
   */
  labelAlign: "left",

  /**
   * 标签位置
   *
   * 未设置时继承 FormContext 的全局 `labelPosition` 配置。
   */
  labelPosition: "left",

  /**
   * 标签宽度
   *
   * 未设置时继承 FormContext 的全局 `labelWidth` 配置。
   */
  labelWidth: "auto",

  /**
   * 校验触发时机
   *
   * 支持单个或多个触发时机组合，如 `'change'`、`'blur'`、`['change', 'blur']`。
   * 未设置时继承 FormContext 的全局 `validationTrigger` 配置。
   */
  validationTrigger: "blur",

  /**
   * 是否在标签后显示冒号
   *
   * 未设置时继承 FormContext 的全局 `colon` 配置。
   */
  colon: true,
} as const

export type DefaultConfigKey = keyof typeof defaultConfig

export const defaultConfigKey = Object.keys(defaultConfig) as DefaultConfigKey[]
