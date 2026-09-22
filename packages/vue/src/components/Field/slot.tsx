/**
 * Field 插槽渲染器。
 *
 * 集中处理字段各区域的插槽解析，保持 Field 仅负责字段状态和布局。
 *
 * @module components/Field/slot
 */

import { computed, h } from "vue"
import type { Component, ShallowRef, Slots, VNodeChild } from "vue"

import classnames from "classnames"

import { extractChildSlots, normalizeNameKey, resolveSlot } from "../../utils"
import Icon from "../Icon"

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
 * 字段依次渲染 Before、主体（Label + Content）、Error、After。
 * Label 和 Error 插槽只替换各自容器内的内容。
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

  const labelWidth = computed(() => {
    if (schemaRef.value.labelPosition === "top") {
      return "100%"
    }

    // 数值和纯数字字符串使用 px，保留带单位的 CSS 宽度。
    const width = schemaRef.value.labelWidth ?? "auto"

    return /^\d+(?:\.\d+)?$/.test(String(width)) ? `${width}px` : width
  })

  const labelAlign = computed(() => {
    if (schemaRef.value.labelPosition === "top") {
      return "left"
    }

    return schemaRef.value.labelAlign
  })

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

    const colon = schemaRef.value.colon ?? formContext.schemaConfig.colon

    // 必填标记使用 label-text 的伪类渲染，不再额外创建 DOM 节点。
    const showRequiredMark =
      (schemaRef.value.showRequiredMark ?? Boolean(schemaRef.value.required)) &&
      !schemaRef.value.disabled &&
      !schemaRef.value.readonly

    return (
      <label
        class="schemx-field__label"
        style={{
          width: labelWidth.value,
          textAlign: labelAlign.value,
          marginLeft: labelAlign.value === "right" ? "auto" : "",
        }}
      >
        {labelSlot ? (
          labelSlot(createSlotProps())
        ) : (
          <>
            {schemaRef.value.labelIcon && (
              <span class="schemx-field__label-icon">
                <Icon
                  icon={schemaRef.value.labelIcon}
                  component={formContext.iconComponent}
                />
              </span>
            )}
            <span
              class={classnames("schemx-field__label-text", {
                "is-required": showRequiredMark,
              })}
            >
              {schemaRef.value.label}
              {colon ? ":" : ""}
            </span>
          </>
        )}
      </label>
    )
  }

  /**
   * 渲染字段主体前的 `{name}Before` 插槽。
   */
  const renderBefore = (): VNodeChild => renderFieldSlot("Before")

  /**
   * 渲染控件区域，优先使用 `{name}Content` 插槽。
   */
  const renderContent = (): VNodeChild => {
    const rendererEntry = form.getRendererEntry(schemaRef.value.componentType)

    if (!rendererEntry) {
      throw new Error(
        `[schemx] Can not find component renderer of "${schemaRef.value.componentType}".`
      )
    }

    const childSlots = extractChildSlots(normalizeNameKey(schemaRef.value.name), slots)

    const transformedProps = rendererEntry.transformProps
      ? rendererEntry.transformProps(componentProps.value, {
          schema: schemaRef.value,
          form,
        })
      : componentProps.value

    const columnElement = h(
      rendererEntry.component as Component,
      transformedProps,
      childSlots
    )

    const contentSlot = resolveSlot(
      slots,
      `${normalizeNameKey(schemaRef.value.name)}Content`
    )

    return (
      <div
        class="schemx-field__content"
        style={{ textAlign: schemaRef.value.contentAlign }}
      >
        {contentSlot
          ? contentSlot(
              createSlotProps({
                columnElement,
              })
            )
          : columnElement}
      </div>
    )
  }

  /**
   * 渲染字段错误区域后的 `{name}After` 插槽。
   */
  const renderAfter = (): VNodeChild => renderFieldSlot("After")

  /**
   * 渲染错误区域，优先使用 `{name}Error` 插槽。
   */
  const renderError = (): VNodeChild => {
    const errorSlot = resolveSlot(slots, `${normalizeNameKey(schemaRef.value.name)}Error`)

    if (!errorSlot && field.errors.value.length === 0) {
      return null
    }

    return (
      <div
        class="schemx-field__error"
        style={{
          marginLeft:
            schemaRef.value?.labelPosition === "top"
              ? "8px"
              : `calc(${labelWidth.value} + var(--schemx-field-gap))`,
        }}
      >
        {errorSlot
          ? errorSlot(createSlotProps({ errors: field.errors.value }))
          : field.errors.value[0]}
      </div>
    )
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
