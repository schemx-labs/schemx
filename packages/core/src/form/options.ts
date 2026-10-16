import { mergeAndResolveSchemxConfig } from "../config/mergeSchemxConfig"
import { createPresetRuleRegistry, createRendererRegistry } from "../registry"

import type { SchemxConfig } from "../config/types"
import type { SchemxSchemasInput } from "../createSchemas"
import type { PresetRuleRegistry, RendererRegistry } from "../registry"
import type { NodeLifecycleHooks } from "../runtime/lifecycle"
import type { ContainerNode } from "../runtime/node"
import type { NamePath, SchemxFieldRulesMap, SchemxSchemaConfig, Values } from "../types"
import type { CreateValidatorOptions, ValidationFailure } from "../validator"

export type { FormPerformanceOptions, FormRegistryOptions } from "../config/types"

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
  lifecycleHooks?: NodeLifecycleHooks<ContainerNode<TValues>>
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

/**
 * 在 Core 层合并 Form 配置、显式继承配置和内置默认值。
 *
 * 本函数不读取全局配置；调用边界决定继承来源。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 用户传入的 Form 配置。
 * @param config - 调用边界显式提供的继承配置。
 * @returns 合并后的原始 Form 配置类型。
 *
 * @example
 * ```ts
 * const options = mergeCreateFormOptions({
 *   initialValues: { name: "Schemx" },
 * }, {})
 * ```
 */
export function mergeCreateFormOptions<TValues extends Values>(
  options: CreateFormOptions<TValues>,
  config: SchemxConfig<TValues>
): ResolvedCreateFormOptions<TValues> {
  // 提取需要单独归一化的配置，其余字段交给默认值解析器。
  const { schemas, initialValues = {} as TValues, onRuleError } = options

  // 表单显式配置优先于调用边界提供的配置。
  const configuredOptions = mergeAndResolveSchemxConfig(options, config)

  const {
    rendererRegistry,
    defaultRendererType,
    presetRuleRegistry,
    schemaConfig,
    rendererProps,
    validatorAdapters,
  } = configuredOptions

  return {
    ...configuredOptions,
    schemas,
    initialValues,
    rendererRegistry: rendererRegistry ?? createRendererRegistry(defaultRendererType),
    presetRuleRegistry: presetRuleRegistry ?? createPresetRuleRegistry(),
    schemaConfig: schemaConfig,
    fieldRules: options.fieldRules,
    rendererProps: rendererProps,
    defaultRendererType: defaultRendererType,
    validatorAdapters: validatorAdapters ?? [],
    onRuleError,
    onFinish: options.onFinish,
    onFinishFailed: options.onFinishFailed,
    onReset: options.onReset,
    onLoadingChange: options.onLoadingChange,
    onValuesChange: options.onValuesChange,
    onFieldsChange: options.onFieldsChange,
    lifecycleHooks: options.lifecycleHooks,
    debug: configuredOptions.debug ?? false,
    schedulerOptions: configuredOptions.schedulerOptions,
    validationConcurrency: configuredOptions.validationConcurrency,
  }
}
