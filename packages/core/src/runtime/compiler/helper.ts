/**
 * Compiler 内部的 Schema 解析辅助函数。
 *
 * @module core/runtime/compiler/helper
 */

import { isDependencySchema, isGroupSchema, NormalizedTrigger } from "../../utils"

import type { SchemaCompilerOptions } from "./types"
import type {
  NamePath,
  SchemxBaseComponentProps,
  SchemxBaseField,
  SchemxComponentProps,
  SchemxField,
  SchemxSchemaConfig,
  ValidationTrigger,
  Values,
} from "../../types"
import type {
  FieldRuntimeDiagnostics,
  FieldValidationState,
  PresentationDependencyOverrides,
  PresentationState,
  ResolvedFieldSchema,
} from "../node/types"

/**
 * 没有祖先容器时使用的默认呈现状态。
 */
export const DEFAULT_PRESENTATION_STATE: PresentationState = {
  visible: true,
  readonly: false,
  disabled: false,
}

type LegacyRendererAlignmentProps = Pick<SchemxBaseComponentProps, "align">

/**
 * 将表单级默认配置应用到字段未显式赋值的属性。
 *
 * 字段中的 `false`、空字符串等有效值必须保留；只有 `null` 或 `undefined` 才继承
 * `schemaConfig`，从而与原有逐字段 `??` 合并语义保持一致。
 *
 * @param schema - 待应用默认值的字段 Schema。
 * @param schemaConfig - 当前 Form 已解析的字段默认配置。
 * @returns 包含表单级默认值的新字段 Schema。
 */
function applyFieldSchemaDefaults<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  schemaConfig: SchemxSchemaConfig
): SchemxBaseField<TValues> {
  const inheritedEntries = Object.entries(schemaConfig).filter(([key]) => {
    const value = Reflect.get(schema, key)

    return value === undefined || value === null
  })

  return {
    ...schema,
    ...Object.fromEntries(inheritedEntries),
  } as SchemxBaseField<TValues>
}

/**
 * 合并字段 Schema 与表单级默认值，生成编译后的静态字段配置。
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
export function compileFieldSchema<TValues extends Values>(
  schema: SchemxBaseField<TValues>,
  key: string,
  options: SchemaCompilerOptions<TValues>
): SchemxBaseField<TValues> {
  const { schemaConfig, formInstance } = options

  const {
    componentProps,
    readonlyPlaceholder,
    validationTrigger,
    dependencies: _dependencies,
    ...rest
  } = applyFieldSchemaDefaults(schema, schemaConfig)

  const rendererComponentProps = options.rendererProps?.[schema.componentType]

  const legacyComponentProps = componentProps as
    (SchemxComponentProps<TValues> & LegacyRendererAlignmentProps) | undefined

  const legacyRendererComponentProps = rendererComponentProps as
    (Partial<SchemxComponentProps<TValues>> & LegacyRendererAlignmentProps) | undefined

  const mergedComponentProps = {
    ...rendererComponentProps,
    ...componentProps,
  } as SchemxComponentProps<TValues>

  const mergedReadonly = rest.readonly

  const mergedPlaceholder = getPlaceholder(schema, rendererComponentProps)

  const mergedReadonlyPlaceholder =
    componentProps?.readonlyPlaceholder ??
    readonlyPlaceholder ??
    rendererComponentProps?.readonlyPlaceholder

  const mergedAlign =
    legacyComponentProps?.align ??
    schema.contentAlign ??
    legacyRendererComponentProps?.align ??
    rest.contentAlign

  const normalizedSchema = {
    ...rest,
    key,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    placeholder: mergedPlaceholder,
    validationTrigger: normalizeTrigger(validationTrigger ?? "blur"),
  } as SchemxBaseField<TValues>

  if (mergedReadonly) {
    normalizedSchema.contentAlign = "right"
    normalizedSchema.labelPosition = "left"
  }

  normalizedSchema.componentProps = {
    ...mergedComponentProps,
    align: mergedReadonly ? "right" : mergedAlign,
    readonly: mergedReadonly,
    readonlyPlaceholder: mergedReadonlyPlaceholder,
    disabled: rest.disabled,
    placeholder: mergedPlaceholder,
    formItemProps: { ...normalizedSchema },
    formInstance,
  } as SchemxComponentProps<TValues>

  return normalizedSchema
}

/**
 * @deprecated 请改用 {@link compileFieldSchema}。
 */
export const buildFieldStaticSchema: typeof compileFieldSchema = compileFieldSchema

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
 * @param schemaState - Schema 编译出的基础状态。
 * @param dependencyOverrides - dependencies 产生的动态覆盖。
 * @param inheritedPresentationState - 父节点传入的有效状态。
 * @returns 当前节点及其后代使用的有效呈现状态。
 */
export function resolvePresentationState(
  schemaState: Partial<PresentationState>,
  dependencyOverrides: PresentationDependencyOverrides,
  inheritedPresentationState: PresentationState = DEFAULT_PRESENTATION_STATE
): PresentationState {
  const visible =
    dependencyOverrides.visible ??
    schemaState.visible ??
    DEFAULT_PRESENTATION_STATE.visible

  const readonly =
    dependencyOverrides.readonly ??
    schemaState.readonly ??
    DEFAULT_PRESENTATION_STATE.readonly

  const disabled =
    dependencyOverrides.disabled ??
    schemaState.disabled ??
    DEFAULT_PRESENTATION_STATE.disabled

  return {
    visible: inheritedPresentationState.visible && visible,
    readonly: inheritedPresentationState.readonly || readonly,
    disabled: inheritedPresentationState.disabled || disabled,
  }
}

// Renderer 与 Field 共同消费的最终展示属性。
type RendererStateProps = Pick<
  ResolvedFieldSchema,
  "disabled" | "readonly" | "placeholder" | "readonlyPlaceholder"
>

interface ResolveComponentPropsOptions<TValues extends Values> {
  // 编译阶段生成的静态 component Props。
  readonly compiledProps: SchemxComponentProps<TValues> | undefined
  // dependencies 生成的动态 component Props。
  readonly dependencyComponentProps: SchemxComponentProps<TValues> | undefined
  // 当前节点最终生效的展示属性。
  readonly resolvedStateProps: RendererStateProps
  // 静态配置对应的展示属性，用于判断是否可以复用静态 Props。
  readonly compiledStateProps: RendererStateProps
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
  const {
    compiledProps,
    dependencyComponentProps,
    resolvedStateProps,
    compiledStateProps,
  } = options

  const hasResolvedStateChanged =
    resolvedStateProps.disabled !== compiledStateProps.disabled ||
    resolvedStateProps.readonly !== compiledStateProps.readonly ||
    resolvedStateProps.placeholder !== compiledStateProps.placeholder ||
    resolvedStateProps.readonlyPlaceholder !== compiledStateProps.readonlyPlaceholder

  if (!dependencyComponentProps && !hasResolvedStateChanged) {
    return compiledProps ?? ({} as SchemxComponentProps<TValues>)
  }

  return {
    ...compiledProps,
    ...dependencyComponentProps,
    ...resolvedStateProps,
    formInstance: compiledProps?.formInstance,
    formItemProps: {
      ...compiledProps?.formItemProps,
      ...resolvedStateProps,
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
export function isValidationStateEqual<TValues extends Values>(
  previous: FieldValidationState<TValues>,
  next: FieldValidationState<TValues>
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
 * @deprecated 请改用 {@link isValidationStateEqual}。
 */
export const isValidationSchemaEqual: typeof isValidationStateEqual =
  isValidationStateEqual

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
