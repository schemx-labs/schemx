/**
 * Node 测试用响应式状态构造与更新工具。
 *
 * 节点直接持有本模块创建的 Signal 和 ComputedSignal；本模块不再提供
 * 状态容器。
 *
 * @module core/runtime/node/__tests__/signalsTestUtils
 */

import { createComputed, createSignal } from "../../../reactivity"
import { isSchemaNode } from "../helper"

import type { ComputedSignal, Signal } from "../../../reactivity"
import type {
  NamePath,
  SchemxBaseField,
  SchemxComponentProps,
  Values,
} from "../../../types"
import type { FieldRules } from "../../../types/rule"
import type {
  FieldDynamicOverrideKey,
  FieldDynamicOverrides,
  FieldEffectiveSchema,
  FieldRuntimeDiagnostics,
  FieldValidationSchema,
  ParentNode,
  PresentationDynamicOverrides,
  PresentationStaticState,
  SchemaNode,
} from "../types"

/**
 * 写入测试用字段动态覆盖时附带的诊断信息。
 */
interface DynamicOverrideMeta<TValues extends Values = Values> {
  readonly source: "dependencies"
  readonly triggerFields: readonly NamePath<TValues>[]
  readonly error?: Error | null
}

/**
 * 创建 Field 节点响应式状态的参数。
 */
export interface CreateFieldRuntimeSignalsOptions<TValues extends Values = Values> {
  /**
   * Field 节点的稳定 id。
   */
  readonly nodeId: number
  /**
   * Field 节点的稳定 key。
   */
  readonly key: string
  /**
   * Field 节点的字段路径。
   */
  readonly name: NamePath<TValues>
  /**
   * Field 节点的静态 schema。
   */
  readonly staticSchema: SchemxBaseField<TValues>
  /**
   * 可选的祖先有效呈现状态。
   */
  readonly inheritedState?: ComputedSignal<PresentationStaticState>
  /**
   * 是否创建 diagnostics Signal。
   */
  readonly debug?: boolean
}

/**
 * Field 节点直接持有的响应式状态。
 */
export interface FieldRuntimeSignals<TValues extends Values = Values> {
  /**
   * 字段路径 Signal。
   */
  readonly name: Signal<NamePath<TValues>>
  /**
   * 字段静态 schema Signal。
   */
  readonly staticSchema: Signal<SchemxBaseField<TValues>>
  /**
   * 字段动态覆盖 Signal。
   */
  readonly dynamicOverrides: Signal<FieldDynamicOverrides<TValues>>
  /**
   * 合并后的字段有效 schema。
   */
  readonly effectiveSchema: ComputedSignal<FieldEffectiveSchema<TValues>>
  /**
   * Validator 使用的字段校验 schema。
   */
  readonly validationSchema: ComputedSignal<FieldValidationSchema<TValues>>
  /**
   * 可选的字段运行时 diagnostics Signal。
   */
  readonly diagnostics?: Signal<FieldRuntimeDiagnostics<TValues>>
}

type FieldDiagnosticsPatch<TValues extends Values> = Omit<
  FieldRuntimeDiagnostics<TValues>,
  "version"
>

/**
 * 创建 Field 节点的 Signal 和 ComputedSignal。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Field 节点响应式状态的初始配置。
 * @returns Field 节点使用的响应式状态集合。
 */
export function createFieldRuntimeSignals<TValues extends Values>(
  options: CreateFieldRuntimeSignalsOptions<TValues>
): FieldRuntimeSignals<TValues> {
  const { key, name, nodeId } = options

  const initialStaticSchema = options.staticSchema

  const inheritedState =
    options.inheritedState ?? createComputed(() => DEFAULT_PRESENTATION_STATE)

  const staticSchema = createSignal<SchemxBaseField<TValues>>(initialStaticSchema, {
    name: `field:${nodeId}:staticSchema`,
  })

  const dynamicOverrides = createSignal<FieldDynamicOverrides<TValues>>(
    {},
    { name: `field:${nodeId}:dynamicOverrides` }
  )

  const diagnostics =
    options.debug === true
      ? createSignal<FieldRuntimeDiagnostics<TValues>>(createInitialDiagnostics(), {
          name: `field:${nodeId}:diagnostics`,
        })
      : undefined

  const nameSignal = createSignal<NamePath<TValues>>(name, {
    name: `field:${nodeId}:name`,
  })

  let previousValidationSchema: FieldValidationSchema<TValues> | undefined

  const validationSchema = createComputed<FieldValidationSchema<TValues>>(() => {
    const base = staticSchema.value

    const overrides = dynamicOverrides.value

    const presentationState = resolvePresentationState(
      base,
      overrides,
      inheritedState.value
    )

    const required = overrides.required ?? base.required ?? false

    const nextValidationSchema: FieldValidationSchema<TValues> = {
      visible: presentationState.visible,
      disabled: presentationState.disabled,
      readonly: presentationState.readonly,
      label: base.label || "",
      required,
      rules: overrides.rules ?? base.rules ?? [],
    }

    if (
      previousValidationSchema &&
      isValidationSchemaEqual(previousValidationSchema, nextValidationSchema)
    ) {
      return previousValidationSchema
    }

    previousValidationSchema = nextValidationSchema

    return nextValidationSchema
  })

  const effectiveSchema = createComputed<FieldEffectiveSchema<TValues>>(() => {
    const base = staticSchema.value

    const overrides = dynamicOverrides.value

    const validation = validationSchema.value

    const readonlyPlaceholder = overrides.readonlyPlaceholder ?? base.readonlyPlaceholder

    const placeholder = overrides.placeholder ?? base.placeholder ?? ""

    const showRequiredMark =
      overrides.showRequiredMark ?? base.showRequiredMark ?? Boolean(validation.required)

    const effectiveRendererProps: RendererEffectiveProps = {
      disabled: validation.disabled,
      readonly: validation.readonly,
      placeholder,
      readonlyPlaceholder,
    }

    const componentProps = resolveComponentProps({
      staticProps: base.componentProps,
      dynamicComponentProps: overrides.componentProps,
      effectiveProps: effectiveRendererProps,
      staticEffectiveProps: {
        disabled: base.disabled ?? false,
        readonly: base.readonly ?? false,
        placeholder: base.placeholder ?? "",
        readonlyPlaceholder: base.readonlyPlaceholder,
      },
    })

    return {
      key,
      name: nameSignal.value,
      componentType: base.componentType,
      label: validation.label,
      visible: validation.visible,
      disabled: validation.disabled,
      readonly: validation.readonly,
      required: validation.required,
      showRequiredMark,
      placeholder,
      readonlyPlaceholder,
      componentProps,
      rules: validation.rules,
      validationTrigger: base.validationTrigger,
    }
  })

  return {
    name: nameSignal,
    staticSchema,
    dynamicOverrides,
    effectiveSchema,
    validationSchema,
    diagnostics,
  }
}

/**
 * 更新 Field 节点的静态配置。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要更新的 Field 响应式状态。
 * @param config - 新的字段路径和静态 schema。
 */
export function setFieldStaticSchema<TValues extends Values>(
  node: FieldRuntimeSignals<TValues>,
  config: {
    readonly name: NamePath<TValues>
    readonly staticSchema: SchemxBaseField<TValues>
  }
): void {
  node.staticSchema.value = config.staticSchema
  node.name.value = config.name
  updateFieldDiagnostics(node, {
    lastUpdatedBy: "static-schema",
    triggerFields: [],
    overriddenKeys: [],
    error: null,
  })
}

/**
 * 写入 Field 节点的动态覆盖。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要更新的 Field 响应式状态。
 * @param overrides - 要写入的动态字段属性。
 * @param meta - 本次覆盖的来源和诊断信息。
 */
export function setFieldDynamicOverrides<TValues extends Values>(
  node: FieldRuntimeSignals<TValues>,
  overrides: FieldDynamicOverrides<TValues>,
  meta: DynamicOverrideMeta<TValues>
): void {
  node.dynamicOverrides.value = overrides
  updateFieldDiagnostics(node, {
    lastUpdatedBy: "dependencies",
    triggerFields: meta.triggerFields,
    overriddenKeys: Object.keys(overrides) as FieldDynamicOverrideKey[],
    error: meta.error ?? null,
  })
}

/**
 * 清空 Field 节点的动态覆盖。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要重置的 Field 响应式状态。
 * @param reason - 触发重置的原因。
 */
export function resetFieldDynamicOverrides<TValues extends Values>(
  node: FieldRuntimeSignals<TValues>,
  reason: "reset" | "dispose" = "reset"
): void {
  node.dynamicOverrides.value = {}
  updateFieldDiagnostics(node, {
    lastUpdatedBy: reason,
    triggerFields: [],
    overriddenKeys: [],
    error: null,
  })
}

/**
 * 创建 Group/Dependency 共用的呈现响应式状态。
 */
export interface CreatePresentationRuntimeSignalsOptions {
  /**
   * 容器节点的稳定 id。
   */
  readonly nodeId: number
  /**
   * 读取容器静态呈现状态的函数。
   */
  readonly getStaticState: () => PresentationStaticState
  /**
   * 祖先节点的有效呈现状态。
   */
  readonly inheritedState: ComputedSignal<PresentationStaticState>
}

/**
 * Group/Dependency 直接持有的呈现响应式状态。
 */
export interface PresentationRuntimeSignals {
  /**
   * 容器节点的动态呈现覆盖 Signal。
   */
  readonly dynamicOverrides: Signal<PresentationDynamicOverrides>
  /**
   * 合并后的容器有效呈现状态。
   */
  readonly effectiveState: ComputedSignal<PresentationStaticState>
}

/**
 * 创建 Group/Dependency 的 Signal 和 ComputedSignal。
 *
 * @param options - 容器呈现状态的初始配置。
 * @returns 容器使用的响应式状态集合。
 */
export function createPresentationRuntimeSignals(
  options: CreatePresentationRuntimeSignalsOptions
): PresentationRuntimeSignals {
  const dynamicOverrides = createSignal<PresentationDynamicOverrides>(
    {},
    { name: `presentation:${options.nodeId}:dynamicOverrides` }
  )

  const effectiveState = createComputed<PresentationStaticState>(() => {
    return resolvePresentationState(
      options.getStaticState(),
      dynamicOverrides.value,
      options.inheritedState.value
    )
  })

  return {
    dynamicOverrides,
    effectiveState,
  }
}

/**
 * 创建节点的祖先容器状态投影。
 *
 * @typeParam TValues - 表单值类型。
 * @param getNode - 返回当前节点的函数，用于读取其父节点。
 * @returns 祖先容器状态的 ComputedSignal。
 */
export function createInheritedPresentationState<TValues extends Values>(
  getNode: () => SchemaNode<TValues>
): ComputedSignal<PresentationStaticState> {
  return createComputed(() => readInheritedPresentationState(getNode().parent))
}

/**
 * 没有祖先容器时使用的默认呈现状态。
 */
export const DEFAULT_PRESENTATION_STATE: PresentationStaticState = {
  visible: true,
  readonly: false,
  disabled: false,
}

/**
 * 解析节点的最终呈现状态。
 *
 * @param staticState - 节点的静态呈现状态。
 * @param overrides - 节点的动态呈现覆盖。
 * @param inheritedState - 祖先节点传入的有效状态。
 * @returns 合并后的有效呈现状态。
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

/**
 * Renderer 与 Field 共同消费的最终展示属性。
 */
type RendererEffectiveProps = Pick<
  FieldEffectiveSchema,
  "disabled" | "readonly" | "placeholder" | "readonlyPlaceholder"
>

/**
 * 合并最终 Renderer Props 所需的静态、动态与有效状态。
 */
interface ResolveComponentPropsOptions<TValues extends Values> {
  readonly staticProps: SchemxComponentProps<TValues> | undefined
  readonly dynamicComponentProps: SchemxComponentProps<TValues> | undefined
  readonly effectiveProps: RendererEffectiveProps
  readonly staticEffectiveProps: RendererEffectiveProps
}

/**
 * 合并最终 Renderer Props，并保留静态 Props 的引用。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - 静态 Props、动态 Props 和有效展示状态。
 * @returns 合并后的 Renderer Props。
 */
function resolveComponentProps<TValues extends Values>(
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

  const mergedProps = {
    ...staticProps,
    ...dynamicComponentProps,
  }

  return {
    ...mergedProps,
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
 * @param previous - 上一轮字段校验配置。
 * @param next - 当前字段校验配置。
 * @returns 两份校验配置等价时返回 `true`。
 */
function isValidationSchemaEqual<TValues extends Values>(
  previous: FieldValidationSchema<TValues>,
  next: FieldValidationSchema<TValues>
): boolean {
  return (
    previous.visible === next.visible &&
    previous.readonly === next.readonly &&
    previous.disabled === next.disabled &&
    previous.label === next.label &&
    previous.required === next.required &&
    areFieldRulesEqual(previous.rules, next.rules)
  )
}

/**
 * 比较规则引用；数组逐项比较以避免新建空数组造成无效更新。
 *
 * @typeParam TValues - 表单值类型。
 * @param previous - 上一轮字段规则。
 * @param next - 当前字段规则。
 * @returns 两份规则引用或数组成员均相同时返回 `true`。
 */
function areFieldRulesEqual<TValues extends Values>(
  previous: FieldRules<TValues, NamePath<TValues>>,
  next: FieldRules<TValues, NamePath<TValues>>
): boolean {
  if (!Array.isArray(previous) || !Array.isArray(next)) {
    return previous === next
  }

  return (
    previous.length === next.length &&
    previous.every((rule, index) => rule === next[index])
  )
}

/**
 * 更新字段 diagnostics。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要更新的 Field 响应式状态。
 * @param patch - 本次要覆盖的诊断信息。
 */
export function updateFieldDiagnostics<TValues extends Values>(
  node: FieldRuntimeSignals<TValues>,
  patch: FieldDiagnosticsPatch<TValues>
): void {
  const diagnostics = node.diagnostics

  if (!diagnostics) {
    return
  }

  const previous = diagnostics.peek()

  diagnostics.value = {
    ...previous,
    ...patch,
    version: previous.version + 1,
  }
}

/**
 * 读取节点的祖先有效呈现状态。
 *
 * @typeParam TValues - 表单值类型。
 * @param parent - 当前节点的父节点。
 * @returns 祖先有效呈现状态；没有 schema 父节点时返回默认状态。
 */
function readInheritedPresentationState<TValues extends Values>(
  parent: ParentNode<TValues> | null
): PresentationStaticState {
  if (isSchemaNode(parent)) {
    return parent.effectiveState.value
  }

  return DEFAULT_PRESENTATION_STATE
}

/**
 * 创建初始 diagnostics。
 *
 * @typeParam TValues - 表单值类型。
 * @returns 初始字段诊断信息。
 */
function createInitialDiagnostics<
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
