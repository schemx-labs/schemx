/**
 * FieldRuntimeState - 字段运行态。
 *
 * 将字段呈现态拆分为静态 schema、动态覆盖和有效状态三个层次。
 * 静态 schema 更新不会隐式清除 dependencies 覆盖；下游 validation 与 view
 * 仅订阅自己需要的有效切片，避免展示属性变化触发无关校验。
 *
 * @module core/runtime/field/runtimeState
 */

import { createComputed } from "../../reactivity/computed"
import { createSignal } from "../../reactivity/signal"
import {
  DEFAULT_PRESENTATION_STATE,
  resolvePresentationState,
} from "../presentation/state"

import type { ComputedSignal } from "../../reactivity/computed"
import type { Signal } from "../../reactivity/signal"
import type {
  FieldRules,
  SchemxComponentProps,
  SchemxResolvedBaseField,
  Values,
} from "../../types"
import type { NamePath } from "../../types/form"
import type { PresentationState } from "../presentation/state"

/**
 * 字段动态覆盖支持的属性 key。
 *
 * 仅列出 dependencies 可以替换的展示与校验属性；字段身份、渲染器类型和
 * 校验触发器始终由静态 schema 决定。
 */
export type FieldDynamicOverrideKey =
  | "componentProps"
  | "placeholder"
  | "readonlyPlaceholder"
  | "required"
  | "showRequiredMark"
  | "readonly"
  | "disabled"
  | "visible"
  | "rules"

/**
 * 字段动态覆盖集合。
 *
 * 未出现的 key 表示不覆盖静态 schema。
 */
export type FieldDynamicOverrides<TValues extends Values = Values> = Partial<
  Pick<SchemxResolvedBaseField<TValues>, FieldDynamicOverrideKey>
>

/**
 * 字段运行时诊断信息。
 *
 * 仅在 debug 模式创建，用于暴露最近一次运行态变更，不能作为业务状态使用。
 */
export interface FieldRuntimeDiagnostics<TValues extends Values = Values> {
  /**
   * 最近一次更新来源。
   */
  readonly lastUpdatedBy: "static-schema" | "dependencies" | "reset" | "dispose"
  /**
   * 运行态更新版本。
   *
   * 每次 static schema、动态覆盖或重置写入时递增。
   */
  readonly version: number
  /**
   * 最近一次 dependencies 触发字段。
   *
   * 静态更新与重置没有触发字段，使用空数组。
   */
  readonly triggerFields: readonly NamePath<TValues>[]
  /**
   * 最近一次动态覆盖涉及的 key。
   */
  readonly overriddenKeys: readonly FieldDynamicOverrideKey[]
  /**
   * 最近一次解析错误。
   *
   * 依赖解析成功或运行态重置后恢复为 null。
   */
  readonly error: Error | null
}

/**
 * 字段有效呈现态。
 *
 * 合并静态 schema、动态覆盖和默认值后的最终字段状态。
 *
 * View 层消费完整配置；Validator 只消费 FieldValidationSchema，以隔离纯展示更新。
 */
export interface FieldEffectiveSchema<TValues extends Values = Values> {
  /** 字段运行时稳定 key。 */
  key: string
  /** 字段当前路径。 */
  name: NamePath<TValues>
  /** 字段渲染器类型。 */
  componentType: SchemxResolvedBaseField<TValues>["componentType"]
  /** 字段显示标签。 */
  label: string
  /** 字段是否可见。 */
  visible: boolean
  /** 字段是否禁用。 */
  disabled: boolean
  /** 字段是否只读。 */
  readonly: boolean
  /** 字段是否必填。 */
  required: SchemxResolvedBaseField<TValues>["required"]
  /** 是否显示必填标记。 */
  showRequiredMark: boolean
  /** 字段占位文案。 */
  placeholder: string
  /** 只读状态下的占位文案。 */
  readonlyPlaceholder?: string
  /** 传递给渲染器的最终组件属性。 */
  componentProps: SchemxComponentProps<TValues>
  /** 字段最终生效的校验规则。 */
  rules: FieldRules<TValues, NamePath<TValues>>
  /** 字段校验触发时机。 */
  validationTrigger: SchemxResolvedBaseField<TValues>["validationTrigger"]
}

/** Renderer 与 Field 共同消费的最终展示属性。 */
type RendererEffectiveProps = Pick<
  FieldEffectiveSchema,
  "disabled" | "readonly" | "placeholder" | "readonlyPlaceholder"
>

/** 合并最终 Renderer Props 所需的静态、动态与有效状态。 */
interface ResolveComponentPropsOptions<TValues extends Values> {
  /** 编译阶段生成的 Renderer Props。 */
  readonly staticProps: SchemxComponentProps<TValues> | undefined
  /** dependencies 返回的 Renderer Props 覆盖。 */
  readonly dynamicProps: SchemxComponentProps<TValues> | undefined
  /** 当前最终生效的展示属性。 */
  readonly effectiveProps: RendererEffectiveProps
  /** 静态 Schema 对应的展示属性，用于判断能否复用原始引用。 */
  readonly staticEffectiveProps: RendererEffectiveProps
}

/** 仅供 Validator 消费的字段有效配置切片。 */
export interface FieldValidationSchema<TValues extends Values = Values> {
  /** 字段是否可见。 */
  readonly visible: boolean
  /** 字段是否只读。 */
  readonly readonly: boolean
  /** 字段是否禁用。 */
  readonly disabled: boolean
  /** 用于生成错误提示的字段标签。 */
  readonly label: string
  /** 字段是否必填。 */
  readonly required: SchemxResolvedBaseField<TValues>["required"]
  /** 字段当前生效的校验规则。 */
  readonly rules: FieldRules<TValues, NamePath<TValues>>
}

/**
 * 字段运行态。
 *
 * staticSchema 与 dynamicOverrides 是唯一可写来源；effectiveSchema 与
 * validationSchema 均为派生值，不应由调用方直接缓存或修改。
 */
export interface FieldRuntimeState<TValues extends Values = Values> {
  /**
   * 字段当前 name path。
   */
  readonly name: Signal<NamePath<TValues>>
  /**
   * 来自编译阶段的规范化静态字段 schema。
   */
  readonly staticSchema: Signal<SchemxResolvedBaseField<TValues>>
  /**
   * 来自 dependencies 的动态覆盖。
   *
   * 缺失属性保留静态值，空对象表示没有动态覆盖。
   */
  readonly dynamicOverrides: Signal<FieldDynamicOverrides<TValues>>
  /**
   * 合并静态 schema、动态覆盖和默认值的完整字段状态。
   */
  readonly effectiveSchema: ComputedSignal<FieldEffectiveSchema<TValues>>
  /** 校验 effect 订阅的稳定配置切片。 */
  readonly validationSchema: ComputedSignal<FieldValidationSchema<TValues>>
  /**
   * 运行时诊断信息。
   *
   * 非 debug 模式不分配该 Signal。
   */
  readonly diagnostics?: Signal<FieldRuntimeDiagnostics<TValues>>
}

/**
 * 创建字段运行态的配置选项。
 */
export interface CreateFieldRuntimeStateOptions<TValues extends Values = Values> {
  /**
   * 节点 ID。
   *
   * 仅用于 Signal 调试名称，不参与字段身份比较。
   */
  readonly nodeId: number
  /**
   * 节点 key。
   *
   * 运行期稳定，用于 ViewSchema 与渲染列表的 key。
   */
  readonly key: string
  /** 字段名。 */
  readonly name: NamePath<TValues>
  /** 已解析静态 Schema。 */
  readonly staticSchema: SchemxResolvedBaseField<TValues>
  /**
   * 祖先 Group/Dependency 合并后的有效容器状态。
   *
   * 字段自身的动态覆盖优先于该状态。
   */
  readonly inheritedState?: ComputedSignal<PresentationState>
  /** 仅 debug 模式创建 diagnostics Signal。 */
  readonly debug?: boolean
}

/**
 * 创建字段运行态。
 *
 * @param options - 创建选项
 * @returns 返回拥有独立 Signal 与 Computed 的字段运行态。
 */
export function createFieldRuntimeState<TValues extends Values>(
  options: CreateFieldRuntimeStateOptions<TValues>
): FieldRuntimeState<TValues> {
  const { key, name, nodeId, staticSchema: initialStaticSchema } = options

  // 容器态只在读取 Computed 时展开，避免复制祖先配置。
  const inheritedState = options.inheritedState

  const staticSchema = createSignal<SchemxResolvedBaseField<TValues>>(
    initialStaticSchema,
    {
      name: `field:${nodeId}:staticSchema`,
    }
  )

  const dynamicOverrides = createSignal<FieldDynamicOverrides<TValues>>(
    {},
    { name: `field:${nodeId}:dynamicOverrides` }
  )

  const diagnostics = options.debug === false
    ? undefined
    : createSignal<FieldRuntimeDiagnostics<TValues>>(createInitialDiagnostics(), {
        name: `field:${nodeId}:diagnostics`,
      })

  const nameSignal = createSignal<NamePath<TValues>>(name, {
    name: `field:${nodeId}:name`,
  })

  // 保持校验切片引用稳定，纯展示更新不应重新驱动 Validator。
  let previousValidationSchema: FieldValidationSchema<TValues> | undefined

  // 仅计算 Validator 真正依赖的字段属性。
  const validationSchema = createComputed<FieldValidationSchema<TValues>>(() => {
    const base = staticSchema.value

    const overrides = dynamicOverrides.value

    const presentationState = resolvePresentationState(
      base,
      overrides,
      inheritedState?.value ?? DEFAULT_PRESENTATION_STATE
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

  // 为 View 层组合完整字段属性与最终 Renderer Props。
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
      dynamicProps: overrides.componentProps,
      effectiveProps: effectiveRendererProps,
      staticEffectiveProps: {
        disabled: base.disabled ?? false,
        readonly: base.readonly ?? false,
        placeholder: base.placeholder ?? "",
        readonlyPlaceholder: base.readonlyPlaceholder,
      },
    })

    // 动态覆盖优先；未覆盖属性依次回退到静态值与运行时默认值。
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

/** 比较校验切片，避免无关展示更新改变 Computed 引用。 */
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

/** 比较规则引用；数组逐项比较以避免新建空数组造成无效更新。 */
function areFieldRulesEqual<TValues extends Values>(
  previous: FieldRules<TValues, NamePath<TValues>>,
  next: FieldRules<TValues, NamePath<TValues>>
): boolean {
  if (!Array.isArray(previous) || !Array.isArray(next)) {
    return previous === next
  }

  return previous.length === next.length && previous.every((rule, index) => rule === next[index])
}

/**
 * 合并最终 Renderer Props，并同步 Field 展示属性。
 *
 * 静态状态未变化且没有 dependencies Props 覆盖时，保留编译阶段对象的
 * 引用与原型；否则以字段有效状态覆盖 Renderer 和 Field 中的展示属性。
 */
function resolveComponentProps<TValues extends Values>(
  options: ResolveComponentPropsOptions<TValues>
): SchemxComponentProps<TValues> {
  const { staticProps, dynamicProps, effectiveProps, staticEffectiveProps } = options

  const hasEffectivePropsChanged =
    effectiveProps.disabled !== staticEffectiveProps.disabled ||
    effectiveProps.readonly !== staticEffectiveProps.readonly ||
    effectiveProps.placeholder !== staticEffectiveProps.placeholder ||
    effectiveProps.readonlyPlaceholder !== staticEffectiveProps.readonlyPlaceholder

  if (!dynamicProps && !hasEffectivePropsChanged) {
    return staticProps ?? ({} as SchemxComponentProps<TValues>)
  }

  // dependencies 只覆盖 Renderer 自有 Props；Core 注入引用必须保留静态值。
  const mergedProps = {
    ...staticProps,
    ...dynamicProps,
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
 * 更新字段静态 schema。
 *
 * 不清空 dynamicOverrides，确保 Schema 热更新不会撤销仍有效的依赖结果。
 *
 * @param state - 字段运行态
 * @param config - 最新字段配置
 */
export function setFieldStaticSchema<TValues extends Values>(
  state: FieldRuntimeState<TValues>,
  config: {
    readonly name: NamePath<TValues>
    readonly staticSchema: SchemxResolvedBaseField<TValues>
  }
): void {
  state.staticSchema.value = config.staticSchema
  state.name.value = config.name

  const prev = state.diagnostics?.peek()

  if (!prev || !state.diagnostics) return

  state.diagnostics.value = {
    ...prev,
    lastUpdatedBy: "static-schema",
    version: prev.version + 1,
    triggerFields: [],
    overriddenKeys: [],
    error: null,
  }
}

/**
 * 动态覆盖元数据。
 */
export interface DynamicOverrideMeta<TValues extends Values = Values> {
  /**
   * 覆盖来源
   */
  readonly source: "dependencies"
  /**
   * 触发字段
   */
  readonly triggerFields: readonly NamePath<TValues>[]
  /**
   * 解析错误
   */
  readonly error?: Error | null
}

/**
 * 写入字段动态覆盖。
 *
 * 只写入 dependencies 明确解析出的覆盖 key；空对象表示当前没有动态覆盖。
 * 写入会使 effectiveSchema 与 Field View Computed 自动重新计算。
 *
 * @param state - 字段运行态
 * @param overrides - 动态覆盖值
 * @param meta - 覆盖元数据
 */
export function setFieldDynamicOverrides<TValues extends Values>(
  state: FieldRuntimeState<TValues>,
  overrides: FieldDynamicOverrides<TValues>,
  meta: DynamicOverrideMeta<TValues>
): void {
  state.dynamicOverrides.value = overrides

  const prev = state.diagnostics?.peek()

  if (!prev || !state.diagnostics) return

  state.diagnostics.value = {
    ...prev,
    lastUpdatedBy: "dependencies",
    version: prev.version + 1,
    triggerFields: meta.triggerFields,
    overriddenKeys: Object.keys(overrides) as FieldDynamicOverrideKey[],
    error: meta.error ?? null,
  }
}

/**
 * 重置字段动态覆盖。
 *
 * 清空 dynamicOverrides 并更新 diagnostics，不修改 staticSchema。
 *
 * @param state - 字段运行态
 * @param reason - 重置原因
 */
export function resetFieldDynamicOverrides<TValues extends Values>(
  state: FieldRuntimeState<TValues>,
  reason?: "reset" | "dispose"
): void {
  state.dynamicOverrides.value = {}

  const prev = state.diagnostics?.peek()

  if (!prev || !state.diagnostics) return

  state.diagnostics.value = {
    ...prev,
    lastUpdatedBy: reason ?? "reset",
    version: prev.version + 1,
    triggerFields: [],
    overriddenKeys: [],
    error: null,
  }
}

/**
 * 创建初始诊断信息，version 从 0 开始。
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
