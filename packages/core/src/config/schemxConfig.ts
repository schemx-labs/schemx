import { normalizeSchemxConfig } from "./normalizeSchemxConfig"

import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type {
  SchemxRendererKey,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  Values,
} from "../types"
import type { ValidationAdapterOption } from "../validator/types"

/**
 * Schemx 整体配置的适配层扩展接口。
 *
 * 通过声明合并扩展整体配置，例如框架组件实现或适配层选项。
 * `schemaConfig` 内的默认值通过 {@link import("../types/form").SchemxSchemaConfigDefinition} 扩展，
 * 实际 Schema 元数据通过 Field、Group、Dynamic 等各自的扩展接口声明。
 *
 * @typeParam TValues - 当前表单值类型，供适配层配置使用。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SchemxConfigDefinition<TValues extends Values = Values> {}

/**
 * 全局、App、Provider 和 Form 可以继承的整体配置。
 *
 * `schemaConfig` 由后续 `createForm` 调用继承；表单显式传入的同名字段覆盖全局值。
 * `configureSchemx()` 替换模块级配置；多层配置的优先级和合并规则由
 * `mergeConfig()` 处理。
 *
 * 实例级数据（schemas / initialValues）、实例级回调
 * （onFinish 等）、`lifecycleHooks` 与 `onRuleError` 不纳入全局配置。
 *
 * @typeParam TValues - 当前表单值类型，关联 Schema 默认值、Renderer Props 和适配层选项。
 */
export interface SchemxConfig<
  TValues extends Values = Values,
> extends SchemxConfigDefinition<TValues> {
  /**
   * 后续 Form 继承的字段默认值。
   *
   * 值类型为 {@link SchemxSchemaConfig}，描述字段状态、校验及适配层展示默认值。
   * Form 显式配置覆盖继承值，字段自身配置再覆盖这些默认值。
   * 缺省属性继续继承；显式 `undefined` 清除低优先级同名值，解析时仅对
   * Core 内置项补回默认值。Registry 和 Adapter 等整体选项保持在本接口的其他属性中。
   */
  readonly schemaConfig?: Partial<SchemxSchemaConfig<TValues>>
  /**
   * 按 Renderer 类型配置的静态默认 Props。
   *
   * 字段 `componentProps`、动态依赖结果和 Runtime 受控属性拥有更高优先级。
   */
  readonly rendererProps?: SchemxRendererPropsMap<TValues>
  /**
   * 后续 Form 创建 Validator 时注册的全局 adapter 列表。
   *
   * Standard Schema 由唯一内置 adapter 支持；原生 `ValidationRule` 是 Core 基础规则，
   * 二者均无需在此注册。
   */
  readonly validatorAdapters?: readonly ValidationAdapterOption[]
  /**
   * 字段未指定 `componentType` 时使用的默认渲染器类型。
   */
  readonly defaultRendererType?: SchemxRendererKey<TValues>
  /**
   * 后续 Form 默认共享的渲染器注册表。
   *
   * 设置后未显式注入注册表的 Form 共享同一实例，
   * `registerRenderer` 等副作用会跨实例传播。
   */
  readonly rendererRegistry?: RendererRegistry
  /**
   * 后续 Form 默认共享的预设规则注册表。
   *
   * 同 {@link rendererRegistry}，设置后跨实例共享。
   */
  readonly presetRuleRegistry?: PresetRuleRegistry
}

// 模块级全局配置；由 configureSchemx() 替换，供后续 Form 创建调用继承。
const EMPTY_SCHEMX_CONFIG = normalizeSchemxConfig({})

let globalConfig: SchemxConfig = EMPTY_SCHEMX_CONFIG

/**
 * 配置 Schemx 的模块级全局默认行为。
 *
 * 该 API 只作用于当前模块级全局配置，不绑定 UI 适配包、Vue App 或组件树作用域。
 * 每次调用都会替换此前的全局配置；无参数调用会清空全局配置。
 * 多个 Vue App 或 SSR 场景应使用 App/ConfigProvider/Form 级配置，避免共享全局状态。
 *
 * @deprecated 请使用 @schemx/core 的 createSchemx 创建独立默认配置实例。
 * @param nextConfig - 替换当前模块级默认配置的配置对象；省略时清空配置。
 *
 * @example
 * ```ts
 * configureSchemx({ schemaConfig: { readonly: true } })
 * ```
 */
export function configureSchemx(nextConfig: SchemxConfig = {}): void {
  globalConfig = normalizeSchemxConfig(nextConfig)
}

/**
 * 读取当前模块级全局配置。
 *
 * @deprecated 请使用 Core 工厂实例的 getConfig。
 * @returns 当前已标准化的全局配置快照。
 *
 * @example
 * ```ts
 * const config = getGlobalSchemxConfig()
 * console.log(config.schemaConfig)
 * ```
 */
export function getGlobalSchemxConfig(): SchemxConfig {
  return globalConfig
}
