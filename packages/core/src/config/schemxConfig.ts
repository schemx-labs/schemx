import { normalizeSchemxConfig } from "./normalizeSchemxConfig"

import type { SchemxConfigDefinition } from "../index"
import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type {
  SchemxRendererKey,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  Values,
} from "../types"
import type { ValidationAdapterOption } from "../validator/types"

/**
 * Schemx 全局默认配置。
 *
 * `schemaConfig` 由后续 `createForm` 调用继承；表单显式传入的同名字段覆盖全局值。
 * 配置采用替换语义，未设置的项不会保留上一次调用的值。
 *
 * 实例级数据（schemas / initialValues）、实例级回调
 * （onFinish 等）、`lifecycleHooks` 与 `onRuleError` 不纳入全局配置。
 *
 * @typeParam TValues - 用于关联 Renderer 类型与默认 Props 的表单值类型。
 */
export interface SchemxConfig<
  TValues extends Values = Values,
> extends SchemxConfigDefinition<TValues> {
  /**
   * 后续 Form 继承的字段默认值。
   *
   * 仅包含 {@link SchemxSchemaConfig} 的字段呈现与行为配置；不包含 schemas、
   * 表单值和生命周期回调等实例级选项。
   */
  readonly schemaConfig?: Partial<SchemxSchemaConfig>
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
