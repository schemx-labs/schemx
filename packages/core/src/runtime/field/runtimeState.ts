/**
 * FieldRuntimeState - 字段运行态。
 *
 * 将字段呈现态拆分为静态 schema、动态覆盖、有效状态和视图状态四个层次，
 * 让静态 schema 更新和动态属性更新走不同入口，便于 dependencies、validation
 * 和 view 模块按需读取对应层次。
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
 */
export interface FieldRuntimeDiagnostics<TValues extends Values = Values> {
  /**
   * 最近一次更新来源
   */
  readonly lastUpdatedBy: "static-schema" | "dependencies" | "reset" | "dispose"
  /**
   * 运行态更新版本
   */
  readonly version: number
  /**
   * 最近一次 dependencies 触发字段
   */
  readonly triggerFields: readonly NamePath<TValues>[]
  /**
   * 最近一次动态覆盖涉及的 key
   */
  readonly overriddenKeys: readonly FieldDynamicOverrideKey[]
  /**
   * 最近一次解析错误
   */
  readonly error: Error | null
}

/**
 * 字段有效呈现态。
 *
 * 合并静态 schema、动态覆盖和默认值后的最终字段状态。
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
 * 拆分静态 schema、动态覆盖、有效状态和视图状态，让不同模块按需读取。
 */
export interface FieldRuntimeState<TValues extends Values = Values> {
  /**
   * 字段当前 name path
   */
  readonly name: Signal<NamePath<TValues>>
  /**
   * 来自 descriptor 的规范化静态字段 schema
   */
  readonly staticSchema: Signal<SchemxResolvedBaseField<TValues>>
  /**
   * 来自 dependencies 的动态覆盖
   */
  readonly dynamicOverrides: Signal<FieldDynamicOverrides<TValues>>
  /**
   * 合并静态 schema、动态覆盖和默认值的有效字段状态
   */
  readonly effectiveSchema: ComputedSignal<FieldEffectiveSchema<TValues>>
  /** 校验 effect 订阅的稳定配置切片。 */
  readonly validationSchema: ComputedSignal<FieldValidationSchema<TValues>>
  /**
   * 运行时诊断信息
   */
  readonly diagnostics?: Signal<FieldRuntimeDiagnostics<TValues>>
}

/**
 * 创建字段运行态的配置选项。
 */
export interface CreateFieldRuntimeStateOptions<TValues extends Values = Values> {
  /**
   * 节点 ID
   */
  readonly nodeId: number
  /**
   * 节点 key
   */
  readonly key: string
  /** 字段名。 */
  readonly name: NamePath<TValues>
  /** 已解析静态 Schema。 */
  readonly staticSchema: SchemxResolvedBaseField<TValues>
  /**
   * 祖先 Group/Dependency 合并后的有效容器状态。
   */
  readonly inheritedState?: ComputedSignal<PresentationState>
  /** 仅 debug 模式创建 diagnostics Signal。 */
  readonly debug?: boolean
}

/**
 * 创建字段运行态。
 *
 * @param options - 创建选项
 * @returns 新创建的 FieldRuntimeState
 */
export function createFieldRuntimeState<TValues extends Values>(
  options: CreateFieldRuntimeStateOptions<TValues>
): FieldRuntimeState<TValues> {
  const { key, name, nodeId, staticSchema: initialStaticSchema } = options

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

  let previousValidationSchema: FieldValidationSchema<TValues> | undefined

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

  const effectiveSchema = createComputed<FieldEffectiveSchema<TValues>>(() => {
    const base = staticSchema.value

    const overrides = dynamicOverrides.value

    const validation = validationSchema.value

    const readonlyPlaceholder = overrides.readonlyPlaceholder ?? base.readonlyPlaceholder

    const showRequiredMark =
      overrides.showRequiredMark ?? base.showRequiredMark ?? Boolean(validation.required)

    const componentProps = resolveComponentProps(
      base.componentProps,
      overrides.componentProps,
      readonlyPlaceholder,
      base.readonlyPlaceholder
    )

    // 合并静态 schema 与动态覆盖：动态覆盖优先，未覆盖的 key 回退到静态值，静态值再回退到默认值
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
      placeholder: overrides.placeholder ?? base.placeholder ?? "",
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

/** 比较校验切片，保持无关展示更新时的 computed identity。 */
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

/** 比较规则引用；数组按元素引用比较以避免空规则数组造成无效更新。 */
function areFieldRulesEqual<TValues extends Values>(
  previous: FieldRules<TValues, NamePath<TValues>>,
  next: FieldRules<TValues, NamePath<TValues>>
): boolean {
  if (!Array.isArray(previous) || !Array.isArray(next)) {
    return previous === next
  }

  return previous.length === next.length && previous.every((rule, index) => rule === next[index])
}

/** 无动态覆盖时保留 componentProps 原始引用与原型。 */
function resolveComponentProps<TValues extends Values>(
  staticProps: SchemxComponentProps<TValues> | undefined,
  dynamicProps: SchemxComponentProps<TValues> | undefined,
  readonlyPlaceholder: string | undefined,
  staticReadonlyPlaceholder: string | undefined
): SchemxComponentProps<TValues> {
  if (!dynamicProps && readonlyPlaceholder === staticReadonlyPlaceholder) {
    return staticProps ?? ({} as SchemxComponentProps<TValues>)
  }

  return {
    ...staticProps,
    ...dynamicProps,
    readonlyPlaceholder,
  } as SchemxComponentProps<TValues>
}

/**
 * 更新字段静态 schema。
 *
 * 只更新 staticSchema 和 diagnostics，不清空 dynamicOverrides。
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
 * 只写入 dependencies 明确解析出的覆盖 key。空对象表示当前没有动态覆盖。
 * 写入后 effectiveSchema 和 Field View computed 自动失效。
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
 * 清空 dynamicOverrides，更新 diagnostics，不修改 staticSchema。
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
