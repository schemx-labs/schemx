/**
 * Compiler 内部的 Schema 解析辅助函数。
 *
 * @module core/runtime/compiler/helper
 */

import { isDependencySchema, isGroupSchema, NormalizedTrigger } from "../../utils"

import type { CompileOptions } from "./types"
import type {
  NamePath,
  SchemxComponentProps,
  SchemxResolvedBaseField,
  ValidationTrigger,
  Values,
} from "../../types"
import type { SchemxBaseField, SchemxField } from "../../types"
import type {
  FieldEffectiveSchema,
  FieldRuntimeDiagnostics,
  FieldValidationSchema,
  PresentationDynamicOverrides,
  PresentationStaticState,
} from "../node/types"

/**
 * 没有祖先容器时使用的默认呈现状态。
 */
export const DEFAULT_PRESENTATION_STATE: PresentationStaticState = {
  visible: true,
  readonly: false,
  disabled: false,
}

/**
 * 合并字段 Schema 与全局默认值，生成编译后的静态字段配置。
 *
 * 字段自身配置优先于 Renderer 默认 Props 和表单级默认配置；只保留编译阶段需要的
 * 静态配置，动态 dependencies 由 Node 单独处理。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 待编译的字段 Schema。
 * @param key - 编译后节点使用的稳定 key。
 * @param options - 表单级默认配置、Renderer Props 和表单实例。
 * @returns 编译后的字段静态配置。
 */
export function buildFieldStaticSchema<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  key: string,
  options: CompileOptions<TValues>
): SchemxResolvedBaseField<TValues> {
  const { schemaConfig, formInstance } = options

  const {
    contentAlign,
    labelIcon,
    labelAlign,
    labelPosition,
    labelWidth,
    colon,
    componentProps,
    visible,
    readonly,
    readonlyPlaceholder,
    disabled,
    required,
    rules,
    showRequiredMark,
    validationTrigger,
    dependencies: _dependencies,
    ...rest
  } = schema

  const rendererComponentProps = options.rendererProps?.[schema.componentType]

  const mergedComponentProps = {
    ...rendererComponentProps,
    ...componentProps,
  } as SchemxComponentProps<TValues>

  const mergedReadonly = readonly ?? schemaConfig.readonly

  const mergedContentAlign = contentAlign ?? schemaConfig.contentAlign

  const mergedPlaceholder = getPlaceholder(schema, rendererComponentProps)

  const mergedReadonlyPlaceholder =
    componentProps?.readonlyPlaceholder ??
    readonlyPlaceholder ??
    rendererComponentProps?.readonlyPlaceholder

  const mergedAlign =
    componentProps?.align ??
    contentAlign ??
    rendererComponentProps?.align ??
    schemaConfig.contentAlign

  const normalizedSchema = {
    ...rest,
    key,
    visible: visible ?? schemaConfig.visible,
    readonly: mergedReadonly,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    disabled: disabled ?? schemaConfig.disabled,
    required: required ?? schemaConfig.required,
    placeholder: mergedPlaceholder,
    showRequiredMark: showRequiredMark ?? schemaConfig.showRequiredMark,
    labelIcon: labelIcon ?? schemaConfig.labelIcon,
    labelAlign: labelAlign ?? schemaConfig.labelAlign,
    labelPosition: labelPosition ?? schemaConfig.labelPosition,
    labelWidth: labelWidth ?? schemaConfig.labelWidth,
    contentAlign: mergedContentAlign,
    colon: colon ?? schemaConfig.colon,
    rules,
    validationTrigger: normalizeTrigger(
      validationTrigger ?? schemaConfig.validationTrigger ?? "blur"
    ),
  } as SchemxResolvedBaseField<TValues>

  if (mergedReadonly) {
    normalizedSchema.contentAlign = "right"
    normalizedSchema.labelPosition = "left"
  }

  normalizedSchema.componentProps = {
    ...mergedComponentProps,
    align: mergedReadonly ? "right" : mergedAlign,
    readonly: mergedReadonly,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    disabled: disabled ?? schemaConfig.disabled,
    placeholder: mergedPlaceholder,
    formItemProps: { ...normalizedSchema },
    formInstance,
  }

  return normalizedSchema
}

/**
 * 根据显式 key 或节点路径生成稳定的运行时节点 key。
 *
 * 没有显式 key 时，key 会编码节点类型、父节点、位置以及 dependency 的触发字段，
 * 用于在 reconcile 中识别可复用的节点。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 要生成 key 的 Schema。
 * @param index - Schema 在父节点 children 中的位置。
 * @param parentKey - 父节点的稳定 key。
 * @returns 用于 keyed reconcile 的稳定节点 key。
 */
export function createNodeKey<TValues extends Values>(
  schema: SchemxField<TValues>,
  index: number,
  parentKey: string
): string {
  const schemaParentKey = parentKey === "schemx:root" ? "" : parentKey

  if (schema.key) {
    return schema.key
  }

  if (isDependencySchema(schema)) {
    const triggerKey = schema.to.map(serializeNamePath).join(",")

    return schemaParentKey
      ? `dependency:${schemaParentKey}/${index}/${triggerKey}`
      : `dependency:${index}/${triggerKey}`
  }

  if (isGroupSchema(schema)) {
    return schemaParentKey ? `group:${schemaParentKey}/${index}` : `group:${index}`
  }

  const nameKey = serializeNamePath(schema.name)

  return schemaParentKey ? `field:${schemaParentKey}/${nameKey}` : `field:${nameKey}`
}

/**
 * 解析节点的最终呈现状态。
 *
 * 当前节点的 visible 受祖先状态共同约束，readonly 和 disabled 则沿祖先链继承为
 * 单调增强状态。
 *
 * @param staticState - Schema 编译出的静态状态。
 * @param overrides - dependencies 产生的动态覆盖。
 * @param inheritedState - 父节点传入的有效状态。
 * @returns 当前节点及其后代使用的有效呈现状态。
 */
export function resolvePresentationState(
  staticState: Partial<PresentationStaticState>,
  overrides: PresentationDynamicOverrides,
  inheritedState: PresentationStaticState = DEFAULT_PRESENTATION_STATE
): PresentationStaticState {
  const visible =
    overrides.visible ?? staticState.visible ?? DEFAULT_PRESENTATION_STATE.visible

  const readonly =
    overrides.readonly ?? staticState.readonly ?? DEFAULT_PRESENTATION_STATE.readonly

  const disabled =
    overrides.disabled ?? staticState.disabled ?? DEFAULT_PRESENTATION_STATE.disabled

  return {
    visible: inheritedState.visible && visible,
    readonly: inheritedState.readonly || readonly,
    disabled: inheritedState.disabled || disabled,
  }
}

// Renderer 与 Field 共同消费的最终展示属性。
type RendererEffectiveProps = Pick<
  FieldEffectiveSchema,
  "disabled" | "readonly" | "placeholder" | "readonlyPlaceholder"
>

interface ResolveComponentPropsOptions<TValues extends Values> {
  // 编译阶段生成的静态 component Props。
  readonly staticProps: SchemxComponentProps<TValues> | undefined
  // dependencies 生成的动态 component Props。
  readonly dynamicComponentProps: SchemxComponentProps<TValues> | undefined
  // 当前节点最终生效的展示属性。
  readonly effectiveProps: RendererEffectiveProps
  // 静态配置对应的展示属性，用于判断是否可以复用静态 Props。
  readonly staticEffectiveProps: RendererEffectiveProps
}

/**
 * 合并最终 Renderer Props，并保留未发生变化时的静态 Props 引用。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 静态 Props、动态覆盖和展示状态。
 * @returns Renderer 最终使用的 Props。
 */
export function resolveComponentProps<TValues extends Values>(
  options: ResolveComponentPropsOptions<TValues>
): SchemxComponentProps<TValues> {
  const { staticProps, dynamicComponentProps, effectiveProps, staticEffectiveProps } =
    options

  const hasEffectivePropsChanged =
    effectiveProps.disabled !== staticEffectiveProps.disabled ||
    effectiveProps.readonly !== staticEffectiveProps.readonly ||
    effectiveProps.placeholder !== staticEffectiveProps.placeholder ||
    effectiveProps.readonlyPlaceholder !== staticEffectiveProps.readonlyPlaceholder

  if (!dynamicComponentProps && !hasEffectivePropsChanged) {
    return staticProps ?? ({} as SchemxComponentProps<TValues>)
  }

  return {
    ...staticProps,
    ...dynamicComponentProps,
    ...effectiveProps,
    formInstance: staticProps?.formInstance,
    formItemProps: {
      ...staticProps?.formItemProps,
      ...effectiveProps,
    },
  } as SchemxComponentProps<TValues>
}

/**
 * 比较校验切片，避免无关展示更新改变 Computed 引用。
 *
 * @typeParam TValues - 表单值类型。
 * @param previous - 上一次校验配置切片。
 * @param next - 当前校验配置切片。
 * @returns 两个校验切片语义相同时返回 `true`。
 */
export function isValidationSchemaEqual<TValues extends Values>(
  previous: FieldValidationSchema<TValues>,
  next: FieldValidationSchema<TValues>
): boolean {
  if (
    previous.visible !== next.visible ||
    previous.readonly !== next.readonly ||
    previous.disabled !== next.disabled ||
    previous.label !== next.label ||
    previous.required !== next.required
  ) {
    return false
  }

  if (!Array.isArray(previous.rules) || !Array.isArray(next.rules)) {
    return previous.rules === next.rules
  }

  const previousRules = previous.rules as readonly unknown[]

  const nextRules = next.rules as readonly unknown[]

  return (
    previousRules.length === nextRules.length &&
    previousRules.every((rule, index) => rule === nextRules[index])
  )
}

/**
 * 创建 debug 模式使用的初始 diagnostics。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 表示静态 Schema 初始状态的 diagnostics。
 */
export function createInitialDiagnostics<
  TValues extends Values,
>(): FieldRuntimeDiagnostics<TValues> {
  return {
    lastUpdatedBy: "static-schema",
    version: 0,
    triggerFields: [],
    overriddenKeys: [],
    error: null,
  }
}

/**
 * 按字段、Renderer 和组件类型推导默认 placeholder。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 当前字段 Schema。
 * @param rendererComponentProps - Renderer 提供的默认 Props。
 * @returns 字段最终使用的 placeholder。
 */
function getPlaceholder<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  rendererComponentProps: Partial<SchemxComponentProps<TValues>> | undefined
): string {
  const placeholder =
    schema.componentProps?.placeholder ??
    schema.placeholder ??
    rendererComponentProps?.placeholder

  if (placeholder != null) {
    return placeholder
  }

  return ["input", "text", "textarea"].includes(schema.componentType)
    ? `请输入${schema.label || schema.name}`
    : `请选择${schema.label || schema.name}`
}

/**
 * 将字段路径序列化为稳定的 key 片段。
 *
 * @param name - 要序列化的字段路径。
 * @returns 字符串形式的字段路径。
 */
function serializeNamePath(name: NamePath): string {
  return Array.isArray(name) ? name.join(".") : String(name)
}

/**
 * 将校验触发时机统一为 Runtime 使用的短名称。
 *
 * @param trigger - 单个或多个原始触发时机。
 * @returns 归一化后的触发时机。
 */
function normalizeTrigger(
  trigger: ValidationTrigger | ValidationTrigger[]
): NormalizedTrigger | NormalizedTrigger[] {
  const normalized: Record<ValidationTrigger, NormalizedTrigger> = {
    onBlur: "blur",
    onChange: "change",
    onSubmit: "submit",
    blur: "blur",
    change: "change",
    submit: "submit",
  }

  const triggers = Array.isArray(trigger) ? trigger : [trigger]

  return triggers.map((item) => normalized[item] ?? "submit")
}
