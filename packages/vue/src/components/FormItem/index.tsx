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
import { computed, defineComponent, h, PropType, toRef } from "vue"
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
 * @typeParam T - 表单值类型
 */
export interface SchemxItemProps<T extends Values = Values> {
  schema: SchemxViewSchema<T>
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

    const schema = () => schemaRef.value

    const field = useField(schema().name)

    createFieldContext(field)

    const trigger = computed<TriggerConfig>(() =>
      mergeTrigger(schema().validationTrigger, formContext.validationTrigger, "onChange")
    )

    /**
     * 是否需要进行校验。
     *
     * 当字段不可见、详情展示、只读或禁用时，无需进行校验。
     */
    const canVerified = computed(() => {
      const isOperate = schema().visible && !schema().readonly && !schema().disabled

      const rules = schema().rules

      const hasRules = Array.isArray(rules) ? rules?.length > 0 : !!schema().rules

      return isOperate && (Boolean(schema().required) || hasRules)
    })

    /** 值变化处理，设置值后根据触发时机决定是否校验 */
    const handleChange = (v: FieldValue<Values, NamePath<Values>>) => {
      field.setValue(v)
      schema().componentProps?.onChange?.(v)

      if (canVerified.value && shouldValidateOn("change", trigger.value)) {
        field.validate()
      }
    }

    /** 失焦处理，根据触发时机决定是否校验 */
    const handleBlur = (v: FieldValue<Values, NamePath<Values>>) => {
      schema().componentProps?.onBlur?.(v)

      if (canVerified.value && shouldValidateOn("blur", trigger.value)) {
        field.validate()
      }
    }

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<SchemxComponentProps<Values>>(
      (): SchemxComponentProps<Values> => {
        const currentSchema = schema()

        return {
          ...currentSchema.componentProps,
          readonly: currentSchema.readonly,
          disabled: currentSchema.disabled,
          placeholder: currentSchema.placeholder,
          formItemProps: currentSchema,
          value: field.getValue(),
          onChange: handleChange,
          onBlur: handleBlur,
          "onUpdate:value": (v) => field.setValue(v),
        }
      }
    )

    /**
     * 渲染 required 星号。
     *
     * `showRequiredMark` 未设置时回退到 `required`；该展示开关不参与校验逻辑。
     * 禁用或只读字段始终不显示星号。
     *
     * @returns 星号 VNode 或空片段
     */
    const renderRequired = (): VNodeChild => {
      const showRequiredMark = schema().showRequiredMark ?? Boolean(schema().required)

      if (!showRequiredMark || schema().disabled || schema().readonly) {
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
      const labelSlot = resolveSlot(slots, `${schema().name}Label`)

      if (labelSlot) {
        return labelSlot(schema())
      }

      const labelAlign = schema().labelAlign || formContext.labelAlign

      const labelWidth = schema().labelWidth || formContext.labelWidth

      const colon = schema().colon ?? formContext.colon

      return (
        <label
          class="schemx-item__label"
          style={{ width: labelWidth, textAlign: labelAlign }}
        >
          {renderRequired()}
          <span class="schemx-item__label-text">
            {schema().label}
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
      const component = form.getRenderer(schema().componentType)

      if (!component) {
        throw new Error(
          `[schemx] Can not find component renderer of "${schema().componentType}".`
        )
      }

      // 提取子渲染器插槽（fieldName:slotName 格式）
      const childSlots = extractChildSlots(normalizeNameKey(schema().name), slots)

      const columnElement = h(component, componentProps.value, childSlots)

      const contentSlot = resolveSlot(slots, `${schema().name}Content`)

      if (contentSlot) {
        return contentSlot({
          ...schema(),
          columnElement,
        })
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
      const errorSlot = resolveSlot(slots, `${schema().name}Error`)

      if (errorSlot) {
        return errorSlot({
          ...schema(),
          errors: field.errors.value,
        })
      }

      if (field.errors.value.length === 0) {
        return null
      }

      return <div class="schemx-item__error">{field.errors.value[0]}</div>
    }

    return (): VNodeChild => {
      if (!schema().visible) {
        return null
      }

      // 整体插槽：完全接管渲染，不包裹任何默认结构
      const itemSlot = resolveSlot(slots, normalizeNameKey(schema().name))

      if (itemSlot) {
        return itemSlot(schema())
      }

      const labelPosition = schema().labelPosition || formContext.labelPosition

      return (
        <div class={classnames("schemx-item-wrapper")} style={schema().style}>
          <div
            class={classnames(
              "schemx-item",
              `schemx-item--label-${labelPosition}`,
              schema().class,
              {
                "is-readonly": schema().readonly,
                "is-disabled": schema().disabled,
              }
            )}
            style={{ ...((schema().style ?? {}) as CSSStyleValue) }}
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

const isViewGroupSchema = <T extends Values>(
  schema: SchemxViewSchema<T>
): schema is SchemxViewGroupSchema<T> => {
  return "children" in schema
}

const normalizeNameKey = (name: unknown): string => {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}
