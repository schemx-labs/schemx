import type { ResolvedSchemxDefaultProps, SchemxDefaultProps } from "./types"

/**
 * 字段级默认配置。
 *
 * 各字段的静态默认值，字段未显式设置时使用。
 * 部分属性可由全局 Schemx 配置或当前 Form 的实例配置覆盖。
 */
export const defaultConfig = Object.freeze({
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
   * 未设置时继承当前 Form 的 `defaultProps.readonly` 配置。
   */
  readonly: false,

  /**
   * 是否禁用（静态默认值）
   *
   * 未设置时继承当前 Form 的 `defaultProps.disabled` 配置。
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
   * 未设置时继承当前 Form 的 `defaultProps.labelAlign` 配置。
   */
  labelAlign: "left",

  /**
   * 标签位置
   *
   * 未设置时继承当前 Form 的 `defaultProps.labelPosition` 配置。
   */
  labelPosition: "left",

  /**
   * 标签宽度
   *
   * 未设置时继承当前 Form 的 `defaultProps.labelWidth` 配置。
   */
  labelWidth: "auto",

  /**
   * 内容对齐方式
   *
   * 未设置时继承当前 Form 的 `defaultProps.contentAlign` 配置。
   */
  contentAlign: "right",

  /**
   * 校验触发时机
   *
   * 支持单个或多个触发时机组合，如 `'change'`、`'blur'`、`['change', 'blur']`。
   * 未设置时继承当前 Form 的 `defaultProps.validationTrigger` 配置。
   */
  validationTrigger: "blur",

  /**
   * 是否在标签后显示冒号
   *
   * 未设置时继承当前 Form 的 `defaultProps.colon` 配置。
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
 * `defaultConfig` 的键集合，用于类型安全的配置访问。
 */
export type DefaultConfigKey = keyof typeof defaultConfig

/**
 * defaultConfig 的所有键数组。
 *
 * 运行时需遍历默认配置字段时使用。
 */
export const defaultConfigKey = Object.keys(defaultConfig) as DefaultConfigKey[]

/**
 * 按优先级合并默认配置层，并补齐全部内置默认值。
 *
 * 后传入的配置层优先级更高。某层显式提供 `undefined` 时回到内置默认值，
 * 与此前 descriptor 中 `value ?? defaultConfig[key]` 的行为保持一致。
 */
export function resolveDefaultConfig(
  ...layers: readonly Partial<SchemxDefaultProps>[]
): ResolvedSchemxDefaultProps {
  const resolved = { ...defaultConfig } as ResolvedSchemxDefaultProps

  for (const layer of layers) {
    for (const key of defaultConfigKey) {
      if (Object.prototype.hasOwnProperty.call(layer, key)) {
        Object.assign(resolved, {
          [key]: layer[key] ?? defaultConfig[key],
        })
      }
    }
  }

  return resolved
}

/**
 * 判断配置对象是否已经包含全部内置默认配置键。
 *
 * @param value - 要检查的部分默认配置。
 * @returns 当配置包含每个内置键时返回 `true`。
 */
export function isResolvedDefaultConfig(
  value: Partial<SchemxDefaultProps>
): value is ResolvedSchemxDefaultProps {
  return defaultConfigKey.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}
