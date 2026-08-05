import {
  getGlobalSchemxConfig,
  mergeAndResolveSchemxConfig,
  type SchemxConfig,
} from "../config"
import { type SchemxSchemasInput } from "../createSchemas"
import {
  createRendererRegistry,
  createValidationRuleRegistry,
  type RendererRegistry,
  type ValidationRuleRegistry,
} from "../registry"

import type { LifecycleListener } from "../runtime/lifecycle"
import type { RuntimeNode } from "../runtime/node"
import type {
  NamePath,
  ResolvedSchemxSchemaConfig,
  SchemxRendererKey,
  SchemxSchemaConfig,
  Values,
} from "../types"
import type {
  CreateValidatorOptions,
  ValidationAdapterOption,
  ValidationFailure,
} from "../validator"

/**
 * `createForm` 的表单数据配置。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface FormSchemaOptions<TValues extends Values = Values> {
  /**
   * 初始 Schema 列表。
   */
  schemas?: SchemxSchemasInput<TValues>
  /**
   * Store 使用的初始表单值。
   */
  initialValues?: TValues

  /**
   * 表单级 Schema 默认配置。
   */
  schemaConfig?: Partial<SchemxSchemaConfig>
}

/**
 * `createForm` 的 Registry 配置。
 */
export interface FormRegistryOptions {
  rendererRegistry?: RendererRegistry
  defaultRendererType?: SchemxRendererKey
  validationRuleRegistry?: ValidationRuleRegistry
  validatorAdapters?: readonly ValidationAdapterOption[]
}

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
   * 字段值变化后的回调。
   */
  onValuesChange?: (
    changedValues: Readonly<Partial<TValues>>,
    latestSnapshot: Readonly<TValues> | TValues
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
  lifecycleHooks?: LifecycleListener<RuntimeNode<TValues>>
}

/**
 * `createForm` 的公开配置。
 *
 * 这是 Core 层的聚合入口；具体能力按数据、配置、回调和生命周期拆分，
 * 便于框架适配层按需组合。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface CreateFormOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>
  extends
    FormSchemaOptions<TValues>,
    FormRegistryOptions,
    FormCallbackOptions<TValues, TName>,
    FormLifecycleOptions<TValues> {}

/**
 * `createForm` 的已归一化配置。
 *
 * 该类型只由 `mergeCreateFormOptions` 返回，保证 Runtime 所需的配置已经补齐。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface ResolvedCreateFormOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends Omit<
  CreateFormOptions<TValues, TName>,
  "initialValues" | "schemaConfig" | "rendererRegistry" | "validationRuleRegistry"
> {
  /** 已完成默认值合并的初始表单值。 */
  initialValues: TValues
  /** 已完成默认值合并的 Schema 配置。 */
  schemaConfig: ResolvedSchemxSchemaConfig
  /** 已解析的 Renderer Registry。 */
  rendererRegistry: RendererRegistry
  /** 已解析的校验规则 Registry。 */
  validationRuleRegistry: ValidationRuleRegistry
}

/**
 * 合并 `createForm` 的内置、全局和 Form 级配置。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 用户传入的 Form 配置。
 * @returns 合并后的原始 Form 配置类型。
 */
export function mergeCreateFormOptions<TValues extends Values>(
  options: CreateFormOptions<TValues>
): ResolvedCreateFormOptions<TValues> {
  // 提取需要单独归一化的配置，其余字段交给默认值解析器。
  const { schemas, initialValues = {} as TValues, onRuleError } = options

  // 按 Form、全局的优先级合并可继承配置。
  const configuredOptions = mergeAndResolveSchemxConfig(
    getFormSchemxConfig(options),
    getGlobalSchemxConfig()
  )

  return {
    schemas,
    initialValues,
    rendererRegistry:
      configuredOptions.rendererRegistry ??
      createRendererRegistry(configuredOptions.defaultRendererType),
    validationRuleRegistry:
      configuredOptions.validationRuleRegistry ?? createValidationRuleRegistry(),
    schemaConfig: configuredOptions.schemaConfig,
    defaultRendererType: configuredOptions.defaultRendererType,
    validatorAdapters: configuredOptions.validatorAdapters ?? [],
    onRuleError,
    onFinish: options.onFinish,
    onFinishFailed: options.onFinishFailed,
    onValuesChange: options.onValuesChange,
    onFieldsChange: options.onFieldsChange,
    lifecycleHooks: options.lifecycleHooks,
  }
}

/**
 * 从 Form 创建选项中提取可参与全局配置合并的字段。
 *
 * 缺省对象与列表会标准化为空值，使低优先级全局配置仍可被纯合并器继承；
 * 标量和 Registry 的 `undefined` 则由合并器忽略，不会覆盖全局配置。
 *
 * @param options - 当前 Form 的完整创建选项。
 * @returns 适合传给 {@link mergeAndResolveSchemxConfig} 的 Form 级配置。
 */
export function getFormSchemxConfig<TValues extends Values>(
  options: CreateFormOptions<TValues>
): SchemxConfig {
  const {
    schemaConfig = {},
    validatorAdapters = [],
    defaultRendererType = undefined,
    rendererRegistry = undefined,
    validationRuleRegistry = undefined,
  } = options

  return {
    schemaConfig,
    defaultRendererType,
    rendererRegistry,
    validationRuleRegistry,
    validatorAdapters,
  }
}
