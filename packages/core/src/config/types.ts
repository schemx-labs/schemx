import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type { SchedulerOptions } from "../runtime/scheduler"
import type {
  SchemxRendererKey,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  Values,
} from "../types"
import type { ValidationAdapterOption } from "../validator"

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
 * 可继承的 Renderer、Registry 与 Validator 配置。
 *
 * @typeParam TValues - 用于关联 Renderer 类型与默认 Props 的表单值类型。
 */
export interface FormRegistryOptions<TValues extends Values = Values> {
  /**
   * 按 Renderer 类型配置的静态默认 Props。
   *
   * 字段 `componentProps`、动态依赖结果和 Runtime 受控属性拥有更高优先级。
   */
  rendererProps?: SchemxRendererPropsMap<TValues>
  /**
   * 后续 Form 创建 Validator 时注册的全局 adapter 列表。
   *
   * Standard Schema 由唯一内置 adapter 支持；原生 `ValidationRule` 是 Core 基础规则，
   * 二者均无需在此注册。
   */
  validatorAdapters?: readonly ValidationAdapterOption[]
  /**
   * 字段未指定 `componentType` 时使用的默认渲染器类型。
   */
  defaultRendererType?: SchemxRendererKey<TValues>
  /**
   * 后续 Form 默认共享的渲染器注册表。
   *
   * 设置后未显式注入注册表的 Form 共享同一实例，
   * `registerRenderer` 等副作用会跨实例传播。
   */
  rendererRegistry?: RendererRegistry
  /**
   * 后续 Form 默认共享的预设规则注册表。
   *
   * 同 {@link rendererRegistry}，设置后跨实例共享。
   */
  presetRuleRegistry?: PresetRuleRegistry
}

/**
 * 可继承的表单性能调度配置。
 */
export interface FormPerformanceOptions {
  /**
   * Scheduler 时间片与 idle 队列配置。
   */
  schedulerOptions?: SchedulerOptions
  /**
   * 整表校验时同时运行的字段数，默认 `8`。
   */
  validationConcurrency?: number
}

/**
 * 工厂、全局、App、Provider 和 Form 可继承的共享默认配置。
 *
 * 表单显式传入的同名字段覆盖继承值，多层配置由 `mergeConfig()` 合并。
 * 实例数据、字段规则、业务回调和生命周期仅由 `CreateFormOptions` 声明。
 *
 * @typeParam TValues - 当前表单值类型，关联 Schema 默认值、Renderer Props 和适配层选项。
 */
export interface SchemxConfig<TValues extends Values = Values>
  extends
    FormRegistryOptions<TValues>,
    FormPerformanceOptions,
    SchemxConfigDefinition<TValues> {
  /**
   * 后续 Form 可继承、也可局部覆盖的 Schema 默认值。
   * 按属性覆盖继承配置，字段自身配置优先；缺省属性继续继承，
   * 显式 `undefined` 清除继承值并在解析阶段回退 Core 默认值。
   */
  schemaConfig?: Partial<SchemxSchemaConfig<TValues>>
  /**
   * 是否生成 Runtime diagnostics 与 View debug DTO，默认关闭。
   */
  debug?: boolean
}
