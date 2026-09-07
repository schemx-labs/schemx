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
export interface SchemxConfig<TValues extends Values = Values> {
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

// 未配置全局默认值时使用的标准化配置基线。
const EMPTY_SCHEMX_CONFIG = normalizeSchemxConfig({})

// 当前生效的模块级全局配置。
let globalConfig: SchemxConfig = EMPTY_SCHEMX_CONFIG

/**
 * 设置后续 createForm 调用使用的全局默认配置。
 *
 * 采用替换语义：多次调用以最后一次为准，不与之前配置合并。
 * SSR 或同一进程多应用场景应改为在每个 Form 上显式传入配置。
 *
 * @param nextConfig - 要替换的全局默认配置。
 */
export function configureSchemx(nextConfig: SchemxConfig = {}): void {
  globalConfig = normalizeSchemxConfig(nextConfig)
}

/**
 * 读取当前已标准化的模块级全局配置。
 *
 * 适配层可用此函数与自身默认配置合并；单个 Form 的局部覆盖和内置默认值
 * 仍应由 `mergeCreateFormOptions()` 处理。
 *
 * @returns 当前生效的全局配置。
 */
export function getGlobalSchemxConfig(): SchemxConfig {
  return globalConfig
}

/**
 * 将用户输入标准化为可安全复用的全局配置。
 *
 * 对象与 adapter 列表会复制并冻结外层；Registry 保持其可变实例语义，以便
 * 配置它的多个 Form 共享注册结果。
 *
 * @param source - 由 `configureSchemx` 接收的用户配置。
 * @returns 已标准化的模块级配置。
 */
function normalizeSchemxConfig(source: SchemxConfig): SchemxConfig {
  return Object.freeze({
    // 复制并冻结字段默认值，避免配置后继续修改源对象影响后续 Form。
    schemaConfig: Object.freeze({ ...(source.schemaConfig ?? {}) }),
    // Renderer Props 只复制配置边界；嵌套 Prop 值保持调用方传入的引用语义。
    rendererProps: normalizeRendererProps(source.rendererProps),
    // 复制 adapter 列表，保持全局列表与调用方数组相互独立。
    validatorAdapters: Object.freeze([...(source.validatorAdapters ?? [])]),
    defaultRendererType: source.defaultRendererType,
    // Registry 是跨 Form 共享的可变服务实例，不对其内部状态深冻。
    rendererRegistry: source.rendererRegistry,
    presetRuleRegistry: source.presetRuleRegistry,
  })
}

/**
 * 复制并冻结 Renderer Props Map 外层及每个 Renderer 的 Props 对象。
 *
 * @param source - 待标准化的 Renderer Props Map。
 * @returns 与输入隔离一层的只读配置；任意嵌套 Prop 值仍保留原引用。
 */
function normalizeRendererProps(
  source: SchemxRendererPropsMap | undefined
): SchemxRendererPropsMap | undefined {
  if (source === undefined) {
    return undefined
  }

  // 每个 Renderer 的 Props 对象单独复制，避免调用方替换顶层属性影响快照。
  const entries = Object.entries(source).map(([type, props]) => {
    return [type, props === undefined ? undefined : Object.freeze({ ...props })]
  })

  return Object.freeze(Object.fromEntries(entries)) as SchemxRendererPropsMap
}
