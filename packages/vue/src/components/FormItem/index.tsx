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
import { computed, defineComponent, h, PropType } from "vue"
import type { VNodeChild } from "vue"

import { isSchemxViewFieldSchema, isViewGroupSchema } from "@schemx/core"
import classnames from "classnames"

import type { TriggerConfig } from "@/utils"

import {
  createFieldContext,
  useField,
  useFormConfigContext,
  useFormContext,
  useStableRef,
} from "../../hooks"
import { useViewSchema } from "../../hooks/useViewSchemas"
import { mergeTrigger, resolveSlot, shouldValidateOn } from "../../utils"
import FormGroup from "../FormGroup"

import { createFormItemSlotRenderers, normalizeNameKey } from "./slot"

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
 * 提供待渲染的原始 ViewSchema；具体字段或分组类型由组件内部运行时收窄。
 */
export interface SchemxItemProps {
  schema: unknown
}

const FormItem = defineComponent({
  name: "SchemxItem",

  props: {
    schema: {
      type: Object as PropType<unknown>,
      required: true,
    },
  },

  /**
   * 根据 schema 类型分发字段组或字段项渲染。
   *
   * @param props - 当前组件的 schema 属性。
   * @param slots - Vue setup 上下文提供的插槽集合。
   */
  setup(props, { slots }) {
    return (): VNodeChild => {
      const schema = props.schema as SchemxViewSchema<Values>

      if (isViewGroupSchema(schema)) {
        return h(FormGroup, { schema }, slots)
      }

      return h(FieldFormItem, { schema }, slots)
    }
  },
})

const FieldFormItem = defineComponent({
  name: "SchemxFieldItem",
  inheritAttrs: false,

  props: {
    schema: {
      type: Object as PropType<unknown>,
      required: true,
    },
  },

  /**
   * 初始化字段上下文，并组合响应式 schema、校验处理器与插槽渲染器。
   *
   * @param props - 当前字段项的 schema 属性。
   * @param attrs - Vue setup 上下文提供的透传属性。
   * @param slots - Vue setup 上下文提供的插槽集合。
   */
  setup(props, { attrs, slots }) {
    const form = useFormContext<Values>()

    const inputSchema = computed<SchemxViewFieldSchema<Values>>(
      () => props.schema as SchemxViewFieldSchema<Values>
    )

    // 按 key 复用表单级 ViewSchema 订阅，避免每个 FormItem 建立独立 Core effect。
    const latestSchema = useViewSchema(form, () => inputSchema.value.key)

    // 优先使用桥接中的最新字段；首帧或字段暂不存在时回退到输入 schema。
    const schemaRef = computed<SchemxViewFieldSchema<Values>>(() => {
      return latestSchema.value && isSchemxViewFieldSchema(latestSchema.value)
        ? latestSchema.value
        : inputSchema.value
    })

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
     * 当字段不可见、只读或禁用时，无需进行校验。
     */
    const canVerified = computed(() => {
      const isOperate =
        schemaRef.value.visible && !schemaRef.value.readonly && !schemaRef.value.disabled

      const rules = schemaRef.value.rules

      const hasRules = Array.isArray(rules) ? rules?.length > 0 : !!schemaRef.value.rules

      return isOperate && (Boolean(schemaRef.value.required) || hasRules)
    })

    /**
     * 处理字段值变化，设置值后根据触发时机决定是否校验。
     *
     * @param v - 渲染器提交的最新字段值。
     */
    const handleChange = (v: FieldValue<Values, NamePath<Values>>) => {
      field.setValue(v)
      schemaRef.value.componentProps?.onChange?.(v)

      if (canVerified.value && shouldValidateOn("change", trigger.value)) {
        field.validate()
      }
    }

    /**
     * 处理字段失焦，并根据触发时机决定是否校验。
     *
     * @param v - 触发失焦事件时对应的字段值。
     */
    const handleBlur = (v: FieldValue<Values, NamePath<Values>>) => {
      schemaRef.value.componentProps?.onBlur?.(v)

      if (canVerified.value && shouldValidateOn("blur", trigger.value)) {
        field.validate()
      }
    }

    /**
     * 处理组件的 v-model 更新，只同步字段值，不主动触发校验。
     *
     * @param v - 渲染器提交的最新字段值。
     */
    const handleValueUpdate = (v: FieldValue<Values, NamePath<Values>>) => {
      field.setValue(v)
    }

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<SchemxComponentProps<Values>>(
      (): SchemxComponentProps<Values> => {
        const currentComponentProps = schemaRef.value.componentProps ?? {}

        return {
          ...currentComponentProps,
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
        <div
          {...attrs}
          class={classnames("schemx-item-wrapper", attrs.class)}
          style={[attrs.style, schemaRef.value.style]}
        >
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
