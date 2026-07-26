import { pick } from "es-toolkit"

import { defaultConfigKey, resolveDefaultConfig } from "../defaultConfig"

import type { RendererRegistry, ValidationRuleRegistry } from "../registry"
import type {
  ResolvedSchemxDefaultProps,
  SchemxDefaultProps,
  SchemxRendererKey,
} from "../types"
import type { ValidationAdapterOption } from "../validator/types"

/**
 * 全局校验默认配置。
 */
export interface SchemxValidationConfig {
  /**
   * 后续 Form 默认注册的校验 adapter。
   *
   * Standard Schema 由唯一内置 adapter 支持；原生 `ValidationRule` 是 Core 基础规则，
   * 二者均无需在此注册。
   */
  readonly validatorAdapters?: readonly ValidationAdapterOption[]
}

/**
 * Schemx 全局默认配置。
 *
 * 表单级呈现默认值（{@link SchemxDefaultProps}）平铺在顶层，
 * 由后续 `createForm` 调用继承；表单显式传入的同名字段覆盖全局值。
 * `validation` 因 `validatorAdapters` 的特殊合并语义而单独成组。
 *
 * 实例级数据（schemas / initialValues / modelValue）、实例级回调
 * （onFinish 等）、`lifecycleHooks` 与 `onRuleError` 不纳入全局配置。
 */
export interface SchemxConfig extends SchemxDefaultProps {
  /**
   * 校验相关的全局默认值。
   */
  readonly validation?: SchemxValidationConfig
  /**
   * 字段未指定 `componentType` 时使用的默认渲染器类型。
   */
  readonly defaultRendererType?: SchemxRendererKey
  /**
   * 后续 Form 默认共享的渲染器注册表。
   *
   * 设置后未显式注入注册表的 Form 共享同一实例，
   * `registerRenderer` 等副作用会跨实例传播。
   */
  readonly rendererRegistry?: RendererRegistry
  /**
   * 后续 Form 默认共享的校验规则注册表。
   *
   * 同 {@link rendererRegistry}，设置后跨实例共享。
   */
  readonly validationRuleRegistry?: ValidationRuleRegistry
}

interface SchemxConfigSnapshot {
  /**
   * 平铺的全局呈现默认值，供 `createForm` 作为 defaultProps 基座。
   */
  readonly defaultProps: Partial<SchemxDefaultProps>
  readonly validation: {
    readonly validatorAdapters: readonly ValidationAdapterOption[]
  }
  readonly defaultRendererType?: SchemxRendererKey
  readonly rendererRegistry?: RendererRegistry
  readonly validationRuleRegistry?: ValidationRuleRegistry
}

/**
 * 单个 Form 可覆盖的全局配置项。
 */
interface FormConfigOverrides {
  readonly defaultProps?: Partial<SchemxDefaultProps>
  readonly defaultRendererType?: SchemxRendererKey
  readonly rendererRegistry?: RendererRegistry
  readonly validationRuleRegistry?: ValidationRuleRegistry
}

/**
 * `createForm` 消费的已解析配置。
 */
interface ResolvedFormConfig {
  readonly defaultProps: ResolvedSchemxDefaultProps
  readonly defaultRendererType?: SchemxRendererKey
  readonly rendererRegistry?: RendererRegistry
  readonly validationRuleRegistry?: ValidationRuleRegistry
  readonly validation: SchemxConfigSnapshot["validation"]
}

let config: SchemxConfigSnapshot = emptyConfig()

/**
 * 设置后续 createForm 调用使用的全局默认配置。
 *
 * 采用替换语义：多次调用以最后一次为准，不与之前配置合并。
 * SSR 或同一进程多应用场景应改为在每个 Form 上显式传入配置。
 *
 * @param nextConfig - 要替换的全局默认配置。
 */
export function configureSchemx(nextConfig: SchemxConfig = {}): void {
  config = snapshot(nextConfig)
}

/**
 * 读取当前全局配置的不可变快照。
 *
 * @returns 可安全用于创建单个 Form 的配置快照。
 */
export function getSchemxConfigSnapshot(): SchemxConfigSnapshot {
  return config
}

/**
 * 将内置、全局与 Form 实例配置解析为单一配置对象。
 *
 * 优先级（高到低）：Form 配置、全局配置、内置默认配置。
 */
export function resolveFormConfig(
  overrides: FormConfigOverrides = {}
): ResolvedFormConfig {
  return {
    defaultProps: resolveDefaultConfig(config.defaultProps, overrides.defaultProps ?? {}),
    defaultRendererType: overrides.defaultRendererType ?? config.defaultRendererType,
    rendererRegistry: overrides.rendererRegistry ?? config.rendererRegistry,
    validationRuleRegistry:
      overrides.validationRuleRegistry ?? config.validationRuleRegistry,
    validation: config.validation,
  }
}

/**
 * 重置模块级配置，供隔离测试使用。
 */
export function resetSchemxConfigForTests(): void {
  config = emptyConfig()
}

function snapshot(source: SchemxConfig): SchemxConfigSnapshot {
  return Object.freeze({
    // 从平铺的 SchemxConfig 中抽出 defaultProps 部分（仅 defaultConfigKey 范围）。
    defaultProps: Object.freeze({ ...pick(source, defaultConfigKey) }),
    validation: Object.freeze({
      validatorAdapters: Object.freeze([...(source.validation?.validatorAdapters ?? [])]),
    }),
    defaultRendererType: source.defaultRendererType,
    // 注册表为可变实例，仅冻结外层容器，不深冻实例本身。
    rendererRegistry: source.rendererRegistry,
    validationRuleRegistry: source.validationRuleRegistry,
  })
}

function emptyConfig(): SchemxConfigSnapshot {
  return snapshot({})
}
