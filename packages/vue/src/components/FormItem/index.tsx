/**
 * FormItem
 *
 * schemx 和 FormGroup 实际渲染字段的组件。
 * 动态属性已由 core 解析到 ViewSchema 中；这里只负责消费
 * 已解析 schema、创建字段实例、组装渲染器属性与插槽。
 *
 * @module components/FormItem
 */

/* eslint-disable vue/one-component-per-file */
import { computed, defineComponent, h, PropType, toRef, getCurrentInstance } from "vue"
import type { VNodeChild } from "vue"

import classnames from "classnames"

import type { TriggerConfig } from "@/utils"

import {
  createFieldContext,
  useField,
  useFormConfigContext,
  useFormContext,
  useStableRef,
} from "../../hooks"
import {
  extractChildSlots,
  mergeTrigger,
  resolveSlot,
  shouldValidateOn,
} from "../../utils"
import FormGroup from "../FormGroup"

import type {
  FieldValue,
  NamePath,
  SchemxComponentProps,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
  Values,
} from "@schemx/core"

/**
 * FormItem 属性。
 *
 * @typeParam TValues - 表单值类型
 */
export interface SchemxItemProps<TValues extends Values = Values> {
  schema: SchemxViewSchema<TValues>
}

const FormItem = defineComponent({
  name: "SchemxItem",

  props: {
    schema: {
      type: Object as PropType<SchemxViewSchema>,
      required: true,
    },
  },

  setup(props, { slots }) {
    return (): VNodeChild => {
      const schema = props.schema

      if (isViewGroupSchema(schema)) {
        return h(FormGroup, { schema }, slots)
      }

      return h(FieldFormItem, { schema }, slots)
    }
  },
})

const FieldFormItem = defineComponent({
  name: "SchemxFieldItem",

  props: {
    schema: {
      type: Object as PropType<SchemxViewFieldSchema>,
      required: true,
    },
  },

  setup(props, { slots }) {
    const schemaRef = toRef(props, "schema")

    const form = useFormContext<Values>()

    const formContext = useFormConfigContext()

    const field = useField(schemaRef.value.name)

    createFieldContext(field)

    const uid = getCurrentInstance()?.uid

    const trigger = computed<TriggerConfig>(() =>
      mergeTrigger(
        schemaRef.value.validationTrigger,
        formContext.schemaConfig.validationTrigger,
        "onChange"
      )
    )

    /**
     * 是否需要进行校验。
     *
     * 当字段不可见、详情展示、只读或禁用时，无需进行校验。
     */
    const canVerified = computed(() => {
      const isOperate =
        schemaRef.value.visible && !schemaRef.value.readonly && !schemaRef.value.disabled

      const rules = schemaRef.value.rules

      const hasRules = Array.isArray(rules) ? rules?.length > 0 : !!schemaRef.value.rules

      return isOperate && (Boolean(schemaRef.value.required) || hasRules)
    })

    /** 值变化处理，设置值后根据触发时机决定是否校验 */
    const handleChange = (v: FieldValue<Values, NamePath<Values>>) => {
      field.setValue(v)
      schemaRef.value.componentProps?.onChange?.(v)

      if (canVerified.value && shouldValidateOn("change", trigger.value)) {
        field.validate()
      }
    }

    /** 失焦处理，根据触发时机决定是否校验 */
    const handleBlur = (v: FieldValue<Values, NamePath<Values>>) => {
      schemaRef.value.componentProps?.onBlur?.(v)

      if (canVerified.value && shouldValidateOn("blur", trigger.value)) {
        field.validate()
      }
    }

    const handleValueUpdate = (v: FieldValue<Values, NamePath<Values>>) => {
      field.setValue(v)
    }

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<SchemxComponentProps<Values>>(
      (): SchemxComponentProps<Values> => {
        const currentSchema = schemaRef.value

        return {
          ...currentSchema.componentProps,
          value: field.value.value,
          onChange: handleChange,
          onBlur: handleBlur,
          "onUpdate:value": handleValueUpdate,
        }
      }
    )

    /**
     * 创建插槽参数。
     *
     * 插槽渲染时直接读取字段 Ref，确保插槽始终订阅当前字段值，
     * 不依赖 componentProps 的引用更新时机。
     */
    const createSlotProps = (additionalProps: Record<string, unknown> = {}) => {
      return {
        ...componentProps.value,
        value: field.getSnapshot(),
        ...additionalProps,
      }
    }

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

    /**
     * 渲染 formItem label 区域。
     *
     * 优先使用 `{name}Label` 插槽（支持 camelCase / kebab-case），
     * 未提供时渲染默认 label（含 required 星号、label 文本、冒号）。
     *
     * @returns label VNode
     */
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

    /**
     * 渲染 formItem content 区域（仅控件）。
     *
     * 优先使用 `{name}Content` 插槽（支持 camelCase / kebab-case），
     * 插槽参数包含 formItemProps 和 columnElement（渲染器 VNode）。
     * 未提供插槽时，渲染默认控件布局。
     *
     * @returns content VNode
     */
    const renderContent = (): VNodeChild => {
      const component = form.getRenderer(schemaRef.value.componentType)

      if (!component) {
        throw new Error(
          `[schemx] Can not find component renderer of "${schemaRef.value.componentType}".`
        )
      }

      // 提取子渲染器插槽（fieldName:slotName 格式）
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

    /**
     * 渲染 formItem error 区域。
     *
     * 优先使用 `{name}Error` 插槽（支持 camelCase / kebab-case），
     * 插槽参数包含 formItemProps 和 errors 数组。
     * 未提供插槽时，仅在存在错误时显示第一条错误信息。
     *
     * @returns error VNode 或 null
     */
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

    return (): VNodeChild => {
      if (!schemaRef.value.visible) {
        return null
      }

      // 整体插槽：完全接管渲染，不包裹任何默认结构
      const itemSlot = resolveSlot(slots, normalizeNameKey(schemaRef.value.name))

      if (itemSlot) {
        return itemSlot(createSlotProps())
      }

      const labelPosition =
        schemaRef.value.labelPosition || formContext.schemaConfig.labelPosition

      return (
        <div class={classnames("schemx-item-wrapper")} style={schemaRef.value.style}>
          <div
            class={classnames(
              "schemx-item",
              `schemx-item--label-${labelPosition}`,
              schemaRef.value.class,
              {
                "is-readonly": schemaRef.value.readonly,
                "is-disabled": schemaRef.value.disabled,
              }
            )}
            style={{ ...((schemaRef.value.style ?? {}) as CSSStyleValue) }}
          >
            {renderLabel()}

            <div class="schemx-item__content">
              {renderContent()}
              {renderError()}
            </div>
          </div>
        </div>
      )
    }
  },
})

export default FormItem

const isViewGroupSchema = <TValues extends Values>(
  schema: SchemxViewSchema<TValues>
): schema is SchemxViewGroupSchema<TValues> => {
  return "children" in schema
}

const normalizeNameKey = (name: unknown): string => {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}
