/**
 * Field 插槽渲染器。
 *
 * 集中处理字段各区域的插槽解析，保持 Field 仅负责字段状态和布局。
 *
 * @module components/Field/slot
 */

import { h } from "vue"
import type { ShallowRef, Slots, VNodeChild } from "vue"

import { extractChildSlots, normalizeNameKey, resolveSlot } from "../../utils"

import type { FormConfigContextValue } from "../../context/formContext"
import type { FieldInstance } from "../../types/field"
import type {
  SchemxComponentProps,
  SchemxInstance,
  SchemxViewFieldSchema,
  Values,
} from "@schemx/core"

/**
 * Field 插槽渲染所需的状态与依赖。
 */
interface FieldSlotRendererOptions<TValues extends Values = Values> {
  /**
   * 当前字段 ViewSchema。
   */
  schemaRef: Readonly<ShallowRef<SchemxViewFieldSchema<TValues>>>
  /**
   * 当前字段的响应式控制器。
   */
  field: FieldInstance<TValues>
  /**
   * 当前表单实例，用于解析 Renderer。
   */
  form: SchemxInstance<TValues>
  /**
   * 表单级展示配置。
   */
  formContext: FormConfigContextValue
  /**
   * 传给 Renderer 的稳定属性。
   */
  componentProps: Readonly<ShallowRef<SchemxComponentProps<TValues>>>
  /**
   * 父组件传入的所有具名插槽。
   */
  slots: Slots
}

/**
 * 创建 Field 各区域的插槽渲染函数。
 *
 * `Before`、`Content`、`After` 依次包裹 Renderer；`Error` 位于控件之后。
 *
 * @param options - Field 插槽渲染所需的响应式状态和 Vue 插槽集合。
 * @returns 各字段区域的插槽渲染函数及统一 Slot Props 构造器。
 *
 * @example
 * ```ts
 * const renderers = createFieldSlotRenderers(options)
 * renderers.renderContent()
 * ```
 */
export function createFieldSlotRenderers<TValues extends Values = Values>(
  options: FieldSlotRendererOptions<TValues>
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

    return <span class="schemx-field__required">*</span>
  }

  /**
   * 构造各字段插槽共用的规范上下文参数。
   *
   * @param additionalProps - 当前插槽额外携带的属性。
   * @returns 传给字段插槽的统一上下文对象。
   */
  const createSlotProps = (additionalProps: Record<string, unknown> = {}) => {
    return {
      schema: schemaRef.value,
      componentProps: componentProps.value,
      value: field.value.value,
      field,
      form,
      ...additionalProps,
    }
  }

  /**
   * 渲染指定后缀的字段区域插槽。
   *
   * @param suffix - 字段插槽名称后缀，例如 `Before` 或 `After`。
   * @returns 匹配插槽生成的 VNode；未匹配时返回空内容。
   */
  const renderFieldSlot = (suffix: string): VNodeChild => {
    const slot = resolveSlot(slots, `${normalizeNameKey(schemaRef.value.name)}${suffix}`)

    return slot?.(createSlotProps()) ?? null
  }

  /**
   * 渲染标签区域，优先使用 `{name}Label` 插槽。
   */
  const renderLabel = (): VNodeChild => {
    const labelSlot = resolveSlot(slots, `${normalizeNameKey(schemaRef.value.name)}Label`)

    if (labelSlot) {
      return labelSlot(createSlotProps())
    }

    const labelAlign = schemaRef.value.labelAlign || formContext.schemaConfig.labelAlign

    const labelWidth = schemaRef.value.labelWidth || formContext.schemaConfig.labelWidth

    const colon = schemaRef.value.colon ?? formContext.schemaConfig.colon

    return (
      <label
        class="schemx-field__label"
        style={{ width: labelWidth, textAlign: labelAlign }}
      >
        {renderRequired()}
        {schemaRef.value.labelIcon ? (
          <span class="schemx-field__label-icon">{schemaRef.value.labelIcon}</span>
        ) : null}
        <span class="schemx-field__label-text">
          {schemaRef.value.label}
          {colon ? ":" : ""}
        </span>
      </label>
    )
  }

  /**
   * 渲染 Renderer 前的 `{name}Before` 插槽。
   */
  const renderBefore = (): VNodeChild => renderFieldSlot("Before")

  /**
   * 渲染控件区域，优先使用 `{name}Content` 插槽。
   */
  const renderContent = (): VNodeChild => {
    const component = form.getRenderer(schemaRef.value.componentType)

    if (!component) {
      throw new Error(
        `[schemx] Can not find component renderer of "${schemaRef.value.componentType}".`
      )
    }

    const childSlots = extractChildSlots(normalizeNameKey(schemaRef.value.name), slots)

    const columnElement = h(component, componentProps.value, childSlots)

    const contentSlot = resolveSlot(
      slots,
      `${normalizeNameKey(schemaRef.value.name)}Content`
    )

    if (contentSlot) {
      return contentSlot(
        createSlotProps({
          columnElement,
        })
      )
    }

    return <div class="schemx-field__control">{columnElement}</div>
  }

  /**
   * 渲染 Renderer 后的 `{name}After` 插槽。
   */
  const renderAfter = (): VNodeChild => renderFieldSlot("After")

  /**
   * 渲染错误区域，优先使用 `{name}Error` 插槽。
   */
  const renderError = (): VNodeChild => {
    const errorSlot = resolveSlot(slots, `${normalizeNameKey(schemaRef.value.name)}Error`)

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

    return <div class="schemx-field__error">{field.errors.value[0]}</div>
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
