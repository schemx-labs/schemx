/**
 * FieldModel - 字段呈现态。
 *
 * FieldModel 只回答“这个字段当前应该怎么呈现”，不持有字段值、name、
 * descriptor、validation 或 lifecycle scope。
 *
 * @module core/field/model
 */

import { defaultConfig } from "../defaultConfig"
import { type FieldDescriptor, getPlaceholder } from "../descriptor"
import { createSignal } from "../reactivity"

import type { Signal } from "../reactivity"
import type { SchemxComponentProps, SchemxRules, Values } from "../types"
import type { DependenciesResolvedProps } from "./dependenciesEffect"

/**
 * 字段呈现态快照。
 */
export interface FieldModelSnapshot<TValues extends Values = Values> {
  /** 是否可见 */
  visible: boolean

  /** 是否禁用 */
  disabled: boolean

  /** 是否只读 */
  readonly: boolean

  /** 是否必填 */
  required: boolean

  /** 字段标签，用于校验错误消息等场景 */
  label: string

  /** 校验规则 */
  rules: SchemxRules | SchemxRules[]

  /** 占位提示文本 */
  placeholder: string

  /** 传递给渲染组件的属性 */
  componentProps: SchemxComponentProps<TValues>
}

/**
 * 字段呈现态模型。
 */
export interface FieldModel<TValues extends Values = Values> {
  /** 当前字段呈现态快照 */
  snapshot: Signal<FieldModelSnapshot<TValues>>
}

/**
 * 创建字段呈现态模型。
 *
 * @param descriptor - 字段 descriptor，提供呈现态初始值。
 * @returns 新创建的 FieldModel。
 */
export function createFieldModel<TValues extends Values = Values>(
  descriptor: FieldDescriptor<TValues>
): FieldModel<TValues> {
  return {
    snapshot: createSignal(createFieldModelSnapshot(descriptor)),
  }
}

/**
 * 用 descriptor 静态 schema 刷新字段呈现态 baseline。
 *
 * @param model - 需要更新的字段模型。
 * @param descriptor - 最新字段 descriptor。
 * @param resolved - 解析结果。
 */
export function updateFieldModel<TValues extends Values = Values>(
  model: FieldModel<TValues>,
  descriptor: FieldDescriptor<TValues>,
  resolved?: DependenciesResolvedProps<TValues>
): void {
  const nextSnapshot = createFieldModelSnapshot(descriptor, resolved)

  if (isSameFieldModelSnapshot(model.snapshot.peek(), nextSnapshot)) {
    return
  }

  model.snapshot.value = nextSnapshot
}

/**
 * 根据 descriptor 和 dependencies 解析结果创建字段呈现态快照。
 */
function createFieldModelSnapshot<TValues extends Values = Values>(
  descriptor: FieldDescriptor<TValues>,
  resolved?: DependenciesResolvedProps<TValues>
): FieldModelSnapshot<TValues> {
  const schema = descriptor.schema

  return {
    visible: resolved?.visible ?? schema.visible ?? defaultConfig.visible,
    disabled: resolved?.disabled ?? schema.disabled ?? defaultConfig.disabled,
    readonly: resolved?.readonly ?? schema.readonly ?? defaultConfig.readonly,
    required: resolved?.required ?? schema.required ?? defaultConfig.required,
    label: schema.label || "",
    rules: (resolved?.rules ?? schema.rules) || [],
    placeholder: resolved?.placeholder ?? schema.placeholder ?? getPlaceholder(schema),
    componentProps: (resolved?.componentProps ?? schema.componentProps) || {},
  }
}

/**
 * 判断字段呈现态快照是否保持不变。
 */
function isSameFieldModelSnapshot<TValues extends Values>(
  current: FieldModelSnapshot<TValues>,
  next: FieldModelSnapshot<TValues>
): boolean {
  return (
    current.visible === next.visible &&
    current.disabled === next.disabled &&
    current.readonly === next.readonly &&
    current.required === next.required &&
    current.label === next.label &&
    isSameArrayOrValue(current.rules, next.rules) &&
    current.placeholder === next.placeholder &&
    isShallowEqualRecord(current.componentProps, next.componentProps)
  )
}

/**
 * 比较数组或单值配置。
 */
function isSameArrayOrValue(current: unknown, next: unknown): boolean {
  if (current === next) {
    return true
  }

  if (!Array.isArray(current) || !Array.isArray(next)) {
    return false
  }

  return (
    current.length === next.length &&
    current.every((value, index) => value === next[index])
  )
}

/**
 * 浅比较对象配置。
 */
function isShallowEqualRecord(current: object, next: object): boolean {
  if (current === next) {
    return true
  }

  const currentKeys = Object.keys(current)
  const nextKeys = Object.keys(next)
  const currentRecord = current as Record<string, unknown>
  const nextRecord = next as Record<string, unknown>

  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every((key) => currentRecord[key] === nextRecord[key])
  )
}
