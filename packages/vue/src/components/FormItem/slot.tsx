/**
 * FormItem 插槽渲染器。
 *
 * 集中处理字段各区域的插槽解析，保持 FormItem 仅负责字段状态和布局。
 *
 * @module components/FormItem/slot
 */

import { h } from "vue"
import type { ShallowRef, Slots, VNodeChild } from "vue"

import { FormContextProps } from "../../hooks/provideFormConfigContext"
import { extractChildSlots, resolveSlot } from "../../utils"

import type { FieldInstance } from "../../types/field"
import type {
  SchemxComponentProps,
  SchemxInstance,
  SchemxViewFieldSchema,
  Values,
} from "@schemx/core"

/** FormItem 插槽渲染所需的状态与依赖。 */
interface FormItemSlotRendererOptions<TValues extends Values = Values> {
  /** 当前字段 ViewSchema。 */
  schemaRef: Readonly<ShallowRef<SchemxViewFieldSchema<TValues>>>
  /** 当前字段的响应式控制器。 */
  field: FieldInstance<TValues>
  /** 当前表单实例，用于解析 Renderer。 */
  form: SchemxInstance<TValues>
  /** 表单级展示配置。 */
  formContext: FormContextProps
  /** 传给 Renderer 的稳定属性。 */
  componentProps: Readonly<ShallowRef<SchemxComponentProps<TValues>>>
  /** 父组件传入的所有具名插槽。 */
  slots: Slots
}

/**
 * 创建 FormItem 各区域的插槽渲染函数。
 *
 * `Before`、`Content`、`After` 依次包裹 Renderer；`Error` 位于控件之后。
 */
export function createFormItemSlotRenderers<TValues extends Values = Values>(
  options: FormItemSlotRendererOptions<TValues>
) {
  const { schemaRef, field, form, formContext, componentProps, slots } = options

  /**
   * 渲染 required 星号。
   *
   * `showRequiredMark` 未设置时回退到 `required`；该展示开关不参与校验逻辑。
   * 禁用或只读字段始终不显示星号。
   *
   * @returns 星号 VNode 或空片段
   */
  const renderRequired = (): VNodeChild => {
    const showRequiredMark =
      schemaRef.value.showRequiredMark ?? Boolean(schemaRef.value.required)

    if (!showRequiredMark || schemaRef.value.disabled || schemaRef.value.readonly) {
      return null
    }

    return <span class="schemx-item__required">*</span>
  }

  /** 构造各字段插槽共用的上下文参数。 */
  const createSlotProps = (additionalProps: Record<string, unknown> = {}) => {
    return {
      ...componentProps.value,
      value: field.getSnapshot(),
      ...additionalProps,
    }
  }

  /** 渲染指定后缀的字段区域插槽。 */
  const renderFieldSlot = (suffix: string): VNodeChild => {
    const slot = resolveSlot(slots, `${schemaRef.value.name}${suffix}`)

    return slot?.(createSlotProps()) ?? null
  }

  /** 渲染标签区域，优先使用 `{name}Label` 插槽。 */
  const renderLabel = (): VNodeChild => {
    const labelSlot = resolveSlot(slots, `${schemaRef.value.name}Label`)

    if (labelSlot) {
      return labelSlot(schemaRef.value)
    }

    const labelAlign = schemaRef.value.labelAlign || formContext.schemaConfig.labelAlign

    const labelWidth = schemaRef.value.labelWidth || formContext.schemaConfig.labelWidth

    const colon = schemaRef.value.colon ?? formContext.schemaConfig.colon

    return (
      <label
        class="schemx-item__label"
        style={{ width: labelWidth, textAlign: labelAlign }}
      >
        {renderRequired()}
        <span class="schemx-item__label-text">
          {schemaRef.value.label}
          {colon ? ":" : ""}
        </span>
      </label>
    )
  }

  /** 渲染 Renderer 前的 `{name}Before` 插槽。 */
  const renderBefore = (): VNodeChild => renderFieldSlot("Before")

  /** 渲染控件区域，优先使用 `{name}Content` 插槽。 */
  const renderContent = (): VNodeChild => {
    const component = form.getRenderer(schemaRef.value.componentType)

    if (!component) {
      throw new Error(
        `[schemx] Can not find component renderer of "${schemaRef.value.componentType}".`
      )
    }

    const childSlots = extractChildSlots(normalizeNameKey(schemaRef.value.name), slots)

    const columnElement = h(component, componentProps.value, childSlots)

    const contentSlot = resolveSlot(slots, `${schemaRef.value.name}Content`)

    if (contentSlot) {
      return contentSlot(
        createSlotProps({
          columnElement,
        })
      )
    }

    return <div class="schemx-item__control">{columnElement}</div>
  }

  /** 渲染 Renderer 后的 `{name}After` 插槽。 */
  const renderAfter = (): VNodeChild => renderFieldSlot("After")

  /** 渲染错误区域，优先使用 `{name}Error` 插槽。 */
  const renderError = (): VNodeChild => {
    const errorSlot = resolveSlot(slots, `${schemaRef.value.name}Error`)

    if (errorSlot) {
      return errorSlot(
        createSlotProps({
          errors: field.errors.value,
        })
      )
    }

    if (field.errors.value.length === 0) {
      return null
    }

    return <div class="schemx-item__error">{field.errors.value[0]}</div>
  }

  return {
    createSlotProps,
    renderAfter,
    renderBefore,
    renderContent,
    renderError,
    renderLabel,
  }
}

/** 将 NamePath 转换为整体字段与 Renderer 子插槽使用的键。 */
export function normalizeNameKey(name: unknown): string {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}
