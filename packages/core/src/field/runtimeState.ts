/**
 * FieldRuntimeState - 字段运行态。
 *
 * 将字段呈现态拆分为静态 schema、动态覆盖、有效状态和视图状态四个层次，
 * 让静态 schema 更新和动态属性更新走不同入口，便于 dependencies、validation
 * 和 view 模块按需读取对应层次。
 *
 * @module core/field/runtimeState
 */

import { createComputed } from "../reactivity/computed"
import { createSignal } from "../reactivity/signal"

import type { ContainerEffectiveState } from "../container/runtimeState"
import type { ComputedSignal } from "../reactivity/computed"
import type { Signal } from "../reactivity/signal"
import type {
  FieldRules,
  SchemxComponentProps,
  SchemxResolvedBaseField,
  Values,
} from "../types"
import type { NamePath } from "../types/form"

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
  /** 最近一次更新来源 */
  readonly lastUpdatedBy: "static-schema" | "dependencies" | "reset" | "dispose"
  /** 运行态更新版本 */
  readonly version: number
  /** 最近一次 dependencies 触发字段 */
  readonly triggerFields: readonly NamePath<TValues>[]
  /** 最近一次动态覆盖涉及的 key */
  readonly overriddenKeys: readonly FieldDynamicOverrideKey[]
  /** 最近一次解析错误 */
  readonly error: Error | null
}

/**
 * 字段有效呈现态。
 *
 * 合并静态 schema、动态覆盖和默认值后的最终字段状态。
 */
export interface FieldEffectiveSchema<TValues extends Values = Values> {
  key: string
  name: NamePath<TValues>
  componentType: SchemxResolvedBaseField<TValues>["componentType"]
  label: string
  visible: boolean
  disabled: boolean
  readonly: boolean
  required: SchemxResolvedBaseField<TValues>["required"]
  showRequiredMark: boolean
  placeholder: string
  readonlyPlaceholder?: string
  componentProps: SchemxComponentProps<TValues>
  rules: FieldRules<TValues, NamePath<TValues>>
  validationTrigger: SchemxResolvedBaseField<TValues>["validationTrigger"]
}

/**
 * 字段运行态。
 *
 * 拆分静态 schema、动态覆盖、有效状态和视图状态，让不同模块按需读取。
 */
export interface FieldRuntimeState<TValues extends Values = Values> {
  /** 字段当前 name path */
  readonly name: Signal<NamePath<TValues>>
  /** 来自 descriptor 的规范化静态字段 schema */
  readonly staticSchema: Signal<SchemxResolvedBaseField<TValues>>
  /** 来自 dependencies 的动态覆盖 */
  readonly dynamicOverrides: Signal<FieldDynamicOverrides<TValues>>
  /** 合并静态 schema、动态覆盖和默认值的有效字段状态 */
  readonly effectiveSchema: ComputedSignal<FieldEffectiveSchema<TValues>>
  /** 渲染层消费的字段 ViewSchema（在 createViewState 阶段接入） */
  readonly viewSchema: ComputedSignal<SchemxResolvedBaseField<TValues>>
  /** 运行时诊断信息 */
  readonly diagnostics: Signal<FieldRuntimeDiagnostics<TValues>>
}

/**
 * 创建字段运行态的配置选项。
 */
export interface CreateFieldRuntimeStateOptions<TValues extends Values = Values> {
  /** 节点 ID */
  readonly nodeId: number
  /** 节点 key */
  readonly key: string
  /** 字段 descriptor */
  readonly descriptor: {
    readonly name: NamePath<TValues>
    readonly staticSchema: SchemxResolvedBaseField<TValues>
  }
  /** 祖先 Group/Dependency 合并后的有效容器状态。 */
  readonly inheritedState?: ComputedSignal<ContainerEffectiveState>
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
  const { key, descriptor } = options

  const schema = descriptor.staticSchema

  const inheritedState = options.inheritedState

  const staticSchema = createSignal<SchemxResolvedBaseField<TValues>>(schema, {
    name: `field:${String(descriptor.name)}:staticSchema`,
  })

  const dynamicOverrides = createSignal<FieldDynamicOverrides<TValues>>(
    {},
    { name: `field:${String(descriptor.name)}:dynamicOverrides` }
  )

  const diagnostics = createSignal<FieldRuntimeDiagnostics<TValues>>(
    createInitialDiagnostics(),
    { name: `field:${String(descriptor.name)}:diagnostics` }
  )

  const name = createSignal<NamePath<TValues>>(descriptor.name, {
    name: `field:${String(descriptor.name)}:name`,
  })

  const effectiveSchema = createComputed<FieldEffectiveSchema<TValues>>(() => {
    const base = staticSchema.value

    const overrides = dynamicOverrides.value

    const readonlyPlaceholder = overrides.readonlyPlaceholder ?? base.readonlyPlaceholder

    const inherited = inheritedState?.value ?? DEFAULT_CONTAINER_STATE

    const ownVisible = overrides.visible ?? base.visible ?? true

    const ownDisabled = overrides.disabled ?? base.disabled ?? false

    const ownReadonly = overrides.readonly ?? base.readonly ?? false

    const required = overrides.required ?? base.required ?? false

    const showRequiredMark =
      overrides.showRequiredMark ?? base.showRequiredMark ?? Boolean(required)

    // 合并静态 schema 与动态覆盖：动态覆盖优先，未覆盖的 key 回退到静态值，静态值再回退到默认值
    return {
      key,
      name: name.value,
      componentType: base.componentType,
      label: base.label || "",
      visible: inherited.visible && ownVisible,
      disabled: inherited.disabled || ownDisabled,
      readonly: inherited.readonly || ownReadonly,
      required,
      showRequiredMark,
      placeholder: overrides.placeholder ?? base.placeholder ?? "",
      readonlyPlaceholder,
      componentProps: {
        ...(base.componentProps ?? {}),
        ...(overrides.componentProps ?? {}),
        readonlyPlaceholder,
      } as SchemxComponentProps<TValues>,
      rules: overrides.rules ?? base.rules ?? [],
      validationTrigger: base.validationTrigger,
    }
  })

  const viewSchema = createComputed<SchemxResolvedBaseField<TValues>>(() => {
    const effective = effectiveSchema.value

    // 以静态 schema 为基座，用有效呈现态覆盖运行时可变字段，保持 viewSchema 形状与 staticSchema 一致
    return {
      ...staticSchema.value,
      visible: effective.visible,
      disabled: effective.disabled,
      readonly: effective.readonly,
      required: effective.required,
      showRequiredMark: effective.showRequiredMark,
      label: effective.label,
      placeholder: effective.placeholder,
      readonlyPlaceholder: effective.readonlyPlaceholder,
      componentProps: effective.componentProps,
      rules: effective.rules,
    }
  })

  return {
    name,
    staticSchema,
    dynamicOverrides,
    effectiveSchema,
    viewSchema,
    diagnostics,
  }
}

const DEFAULT_CONTAINER_STATE: ContainerEffectiveState = {
  visible: true,
  readonly: false,
  disabled: false,
}

/**
 * 更新字段静态 schema。
 *
 * 只更新 staticSchema 和 diagnostics，不清空 dynamicOverrides。
 *
 * @param state - 字段运行态
 * @param descriptor - 最新字段 descriptor
 */
export function setFieldStaticSchema<TValues extends Values>(
  state: FieldRuntimeState<TValues>,
  descriptor: {
    readonly name: NamePath<TValues>
    readonly staticSchema: SchemxResolvedBaseField<TValues>
  }
): void {
  state.staticSchema.value = descriptor.staticSchema
  state.name.value = descriptor.name

  const prev = state.diagnostics.peek()

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
  /** 覆盖来源 */
  readonly source: "dependencies"
  /** 触发字段 */
  readonly triggerFields: readonly NamePath<TValues>[]
  /** 解析错误 */
  readonly error?: Error | null
}

/**
 * 写入字段动态覆盖。
 *
 * 只写入 dependencies 明确解析出的覆盖 key。空对象表示当前没有动态覆盖。
 * 写入后 effectiveSchema 和 viewSchema 由 computed 自动失效。
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

  const prev = state.diagnostics.peek()

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

  const prev = state.diagnostics.peek()

  state.diagnostics.value = {
    ...prev,
    lastUpdatedBy: reason ?? "reset",
    version: prev.version + 1,
    triggerFields: [],
    overriddenKeys: [],
    error: null,
  }
}

/** 创建初始诊断信息，version 从 0 开始。 */
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
