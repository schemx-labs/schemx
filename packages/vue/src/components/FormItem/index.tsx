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
import { mergeTrigger, resolveSlot, shouldValidateOn } from "../../utils"
import FormGroup from "../FormGroup"
import { createFormItemSlotRenderers, normalizeNameKey } from "./slot"

import { isViewGroupSchema } from "@schemx/core"
import type {
  FieldValue,
  NamePath,
  SchemxComponentProps,
  SchemxViewFieldSchema,
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

    const {
      createSlotProps,
      renderAfter,
      renderBefore,
      renderContent,
      renderError,
      renderLabel,
    } = createFormItemSlotRenderers({
      schemaRef,
      field,
      form,
      formContext,
      componentProps,
      slots,
    })

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
              {renderBefore()}
              {renderContent()}
              {renderAfter()}
              {renderError()}
            </div>
          </div>
        </div>
      )
    }
  },
})

export default FormItem
