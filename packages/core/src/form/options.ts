import { pick } from "es-toolkit"

import { resolveFormConfig } from "../config/schemxConfig"
import { type SchemxSchemasInput } from "../createSchemas"
import { defaultConfigKey } from "../defaultConfig"
import {
  createRendererRegistry,
  createValidationRuleRegistry,
  type RendererRegistry,
  type ValidationRuleRegistry,
} from "../registry"

import type { SchemxLifecycleHooks } from "../runtime/lifecycle"
import type {
  NamePath,
  ResolvedSchemxDefaultProps,
  SchemxDefaultProps,
  SchemxRendererKey,
  Values,
} from "../types"
import type {
  CreateValidatorOptions,
  ValidationAdapterOption,
  ValidationFailure,
} from "../validator"

/**
 * `createForm` 的公开配置。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 字段路径类型。
 */
export interface CreateFormOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends SchemxDefaultProps {
  /**
   * 初始 Schema 列表。
   */
  schemas?: SchemxSchemasInput<TValues>
  /**
   * Store 使用的初始表单值。
   */
  initialValues?: TValues
  /**
   * 受控模式下合并到初始值之后的表单值。
   */
  modelValue?: TValues
  /**
   * Form 使用的渲染器 Registry。
   */
  rendererRegistry?: RendererRegistry
  /**
   * 未找到指定 renderer 时使用的默认 renderer 类型。
   */
  defaultRendererType?: SchemxRendererKey
  /**
   * Form 使用的命名校验规则 Registry。
   */
  validationRuleRegistry?: ValidationRuleRegistry
  /**
   * Form 级校验 adapter；同 ID 覆盖需显式设置 `override: true`。
   */
  validatorAdapters?: readonly ValidationAdapterOption[]
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
  /**
   * Runtime 生命周期钩子。
   */
  lifecycleHooks?: SchemxLifecycleHooks<TValues>
}

/**
 * 解析后的 Form 配置，供 Model、Controller 和 Runtime 初始化使用。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface ResolvedCreateFormOptions<TValues extends Values> {
  /**
   * 解析后的 Schema 输入。
   */
  schemas?: SchemxSchemasInput<TValues>
  /**
   * 合并 `initialValues` 与 `modelValue` 后的初始值。
   */
  initialValues: TValues
  /**
   * Form 使用的渲染器 Registry。
   */
  rendererRegistry: RendererRegistry
  /**
   * Form 使用的命名校验规则 Registry。
   */
  validationRuleRegistry: ValidationRuleRegistry
  /**
   * 内置默认值、全局默认值与 Form 默认值合并后的配置。
   */
  defaultProps: ResolvedSchemxDefaultProps
  /**
   * 解析后的 fallback renderer 类型。
   */
  defaultRendererType?: SchemxRendererKey
  /**
   * 解析后的校验 adapter 配置。
   */
  validatorAdapters: readonly ValidationAdapterOption[]
  /**
   * 校验规则解析错误回调。
   */
  onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]
  /**
   * 提交和值变化回调集合。
   */
  callbacks: Pick<
    CreateFormOptions<TValues>,
    "onFinish" | "onFinishFailed" | "onValuesChange" | "onFieldsChange"
  >
  /**
   * Runtime 生命周期钩子。
   */
  lifecycleHooks?: SchemxLifecycleHooks<TValues>
}

/**
 * 将 `createForm` 输入解析为稳定的内部配置。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 用户传入的 Form 配置。
 * @returns 可供各子模块初始化的解析配置。
 */
export function resolveCreateFormOptions<TValues extends Values>(
  options: CreateFormOptions<TValues>
): ResolvedCreateFormOptions<TValues> {
  // 提取需要单独归一化的配置，其余字段交给默认值解析器。
  const {
    schemas,
    initialValues = {} as TValues,
    modelValue,
    rendererRegistry,
    defaultRendererType,
    validationRuleRegistry,
    validatorAdapters,
    onRuleError,
    ...restOptions
  } = options

  // 合并全局与 Form 级默认配置及 Registry。
  const resolvedConfig = resolveFormConfig({
    defaultProps: pick(restOptions, defaultConfigKey),
    defaultRendererType,
    rendererRegistry,
    validationRuleRegistry,
  })

  return {
    schemas,
    initialValues: { ...initialValues, ...(modelValue ?? {}) },
    rendererRegistry:
      resolvedConfig.rendererRegistry ??
      createRendererRegistry(resolvedConfig.defaultRendererType),
    validationRuleRegistry:
      resolvedConfig.validationRuleRegistry ?? createValidationRuleRegistry(),
    defaultProps: resolvedConfig.defaultProps,
    defaultRendererType: resolvedConfig.defaultRendererType,
    validatorAdapters: [
      ...resolvedConfig.validation.validatorAdapters,
      ...(validatorAdapters ?? []),
    ],
    onRuleError,
    callbacks: {
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
      onValuesChange: options.onValuesChange,
      onFieldsChange: options.onFieldsChange,
    },
    lifecycleHooks: options.lifecycleHooks,
  }
}
