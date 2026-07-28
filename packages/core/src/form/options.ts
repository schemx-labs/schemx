import { mergeSchemaConfig } from "../config/defaultSchemaConfig"
import { readGlobalSchemxConfig } from "../config/schemxConfig"
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
  const {
    schemas,
    initialValues = {} as TValues,
    rendererRegistry,
    defaultRendererType,
    validationRuleRegistry,
    validatorAdapters,
    onRuleError,
    schemaConfig: formSchemaConfig,
  } = options

  // 读取当前 Form 创建时生效的模块级全局配置。
  const globalConfig = readGlobalSchemxConfig()

  // 按 Form、全局、内置默认值的优先级解析字段默认值。
  const schemaConfig = mergeSchemaConfig(
    globalConfig.schemaConfig ?? {},
    formSchemaConfig ?? {}
  )

  // Form 显式配置优先于模块级默认 renderer 类型。
  const resolvedDefaultRendererType =
    defaultRendererType ?? globalConfig.defaultRendererType

  // Form 显式注入的 Registry 优先于模块级共享 Registry。
  const resolvedRendererRegistry = rendererRegistry ?? globalConfig.rendererRegistry

  // Form 显式注入的规则 Registry 优先于模块级共享 Registry。
  const resolvedValidationRuleRegistry =
    validationRuleRegistry ?? globalConfig.validationRuleRegistry

  return {
    schemas,
    initialValues,
    rendererRegistry:
      resolvedRendererRegistry ?? createRendererRegistry(resolvedDefaultRendererType),
    validationRuleRegistry:
      resolvedValidationRuleRegistry ?? createValidationRuleRegistry(),
    schemaConfig,
    defaultRendererType: resolvedDefaultRendererType,
    validatorAdapters: [
      ...(globalConfig.validatorAdapters ?? []),
      ...(validatorAdapters ?? []),
    ],
    onRuleError,
    onFinish: options.onFinish,
    onFinishFailed: options.onFinishFailed,
    onValuesChange: options.onValuesChange,
    onFieldsChange: options.onFieldsChange,
    lifecycleHooks: options.lifecycleHooks,
  }
}
