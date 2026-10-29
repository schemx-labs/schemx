import type { SchemxSchemasInput } from "../createSchemas"
import type { LifecycleHooks } from "../lifecycle"
import type { ContainerNode } from "../node"
import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type { SchedulerOptions } from "../scheduler"
import type {
  NamePath,
  SchemxFieldRulesMap,
  SchemxRendererKey,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  Values,
} from "../types"
import type {
  CreateValidatorOptions,
  ValidationAdapterOption,
  ValidationFailure,
} from "../validator"

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

/**
 * 表单数据与局部默认配置的兼容分组。
 *
 * 共享选项从 `SchemxConfig` 复用，实例数据由当前分组声明。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface FormSchemaOptions<TValues extends Values = Values> extends Pick<
  SchemxConfig<TValues>,
  "schemaConfig" | "debug"
> {
  /**
   * 初始 Schema 列表。
   */
  schemas?: SchemxSchemasInput<TValues>
  /**
   * Store 使用的初始表单值。
   */
  initialValues?: TValues

  /**
   * 按字段路径配置的字段规则兜底。
   */
  fieldRules?: SchemxFieldRulesMap<TValues>
}

type CallbackValues<TValues extends Values> = 0 extends 1 & TValues ? Values : TValues

/**
 * `createForm` 的回调配置。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface FormCallbackOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 无法解析校验规则时调用的回调。
   */
  onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]
  /**
   * 校验成功后的提交回调。
   */
  onFinish?: (values: Readonly<TValues>) => void | Promise<void>
  /**
   * 校验失败后的提交回调。
   */
  onFinishFailed?: (failure: ValidationFailure<TValues>) => void
  /**
   * 完整表单重置完成后调用。
   *
   * 不会在 `resetFields()` 时触发。
   */
  onReset?: () => void
  /**
   * 提交流程开始或结束时调用。
   *
   * 状态覆盖依赖等待、校验和 `onFinish` 返回的异步任务。
   *
   * @param loading - 当前是否处于提交流程中。
   */
  onLoadingChange?: (loading: boolean) => void
  /**
   * 字段值变化后的回调。
   */
  onValuesChange?: (
    changedValues: Readonly<Partial<CallbackValues<TValues>>>,
    latestSnapshot: Readonly<CallbackValues<TValues>> | CallbackValues<TValues>
  ) => void
  /**
   * 字段路径变化后的回调。
   */
  onFieldsChange?: (changedFields: TName[], allFields: TName[]) => void
}

/**
 * `createForm` 的生命周期配置。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface FormLifecycleOptions<TValues extends Values = Values> {
  /**
   * Runtime 生命周期钩子。
   */
  lifecycleHooks?: LifecycleHooks<ContainerNode<TValues>>
}

/**
 * `createForm` 的公开配置。
 *
 * 在共享默认配置 `SchemxConfig` 上增加实例数据、回调和生命周期。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface CreateFormOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>
  extends
    SchemxConfig<TValues>,
    FormSchemaOptions<TValues>,
    FormCallbackOptions<TValues, TName>,
    FormLifecycleOptions<TValues> {}

/**
 * `createForm` 的已归一化配置。
 *
 * 描述共享配置解析完成后的创建选项，保留现有类型引用。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface ResolvedCreateFormOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends Omit<
  CreateFormOptions<TValues, TName>,
  "initialValues" | "schemaConfig" | "rendererRegistry" | "presetRuleRegistry"
> {
  /**
   * 已完成默认值合并的初始表单值。
   */
  initialValues: TValues
  /**
   * 已完成配置层合并并补齐 Core 默认值的字段默认配置。
   * 保留当前表单的 `TValues`；适配层扩展属性仍可省略。
   */
  schemaConfig: SchemxSchemaConfig<TValues>
  /**
   * 已解析的 Renderer Registry。
   */
  rendererRegistry: RendererRegistry
  /**
   * 已解析的预设规则 Registry。
   */
  presetRuleRegistry: PresetRuleRegistry
}
