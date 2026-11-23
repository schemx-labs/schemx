/**
 * FormItem
 *
 * schemx 和 FormGroup 实际渲染字段的组件。
 * 动态属性已由 core 解析到 ViewSchema 中；这里只负责消费
 * 已解析 schema、创建字段实例、组装渲染器属性与插槽。
 *
 * @module components/FormItem
 */

import { computed, defineComponent, h, PropType, toRef } from "vue"
import type { SetupContext, VNodeChild } from "vue"

import classnames from "classnames"
import { omit } from "es-toolkit"

import { useField } from "../../hooks"
import { useContext } from "../../hooks/useContext"
import { provideFieldContext } from "../../hooks/useFieldContext"
import { useFormInstance } from "../../hooks/useForm"
import { useStableRef } from "../../hooks/useStableRef"
import {
  extractChildSlots,
  mergeTrigger,
  resolveSlot,
  shouldValidateOn,
} from "../../utils"
import FormGroup from "../FormGroup"

import type { TriggerConfig } from "../../utils"
import type {
  FieldValue,
  NamePath,
  SchemxComponentProps,
  SchemxFormItemProps,
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

const FormItem = defineComponent(
  <T extends Values = Values>(props: SchemxItemProps<T>, { slots }: SetupContext) => {
    const schemaRef = toRef(props, "schema")

    if (isViewGroupSchema(schemaRef.value)) {
      return (): VNodeChild => {
        return h(FormGroup, { schema: schemaRef.value as SchemxViewGroupSchema }, slots)
      }
    }

    const form = useFormInstance<T>()
    const formContext = useContext()

    const schema = (): SchemxViewFieldSchema<T> =>
      schemaRef.value as SchemxViewFieldSchema<T>

    const field = useField(schema().name)

    provideFieldContext(field)

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

      return isOperate && hasRules
    })

    /** 值变化处理，设置值后根据触发时机决定是否校验 */
    const handleChange = (v: FieldValue<T, NamePath<T>>) => {
      field.setValue(v)
      schema().componentProps?.onChange?.(v)

      if (canVerified.value && shouldValidateOn("change", trigger.value)) {
        field.validate()
      }
    }

    /** 失焦处理，根据触发时机决定是否校验 */
    const handleBlur = () => {
      // schema().componentProps?.onBlur?.()

      if (canVerified.value && shouldValidateOn("blur", trigger.value)) {
        field.validate()
      }
    }

    /**
     * schemas 每一项的 props
     */
    const formItemProps = computed<SchemxFormItemProps<T>>((): SchemxFormItemProps<T> => {
      return {
        ...(omit(schema(), ["componentProps"]) satisfies SchemxFormItemProps<T>),
        name: schema().name,
        componentType: schema().componentType,
        class: classnames("schemx-item", schema().class),
        required: schema().required,
        readonly: schema().readonly,
        disabled: schema().disabled,
        visible: schema().visible,
        placeholder: schema().placeholder,
        validationTrigger: trigger.value,
      }
    })

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<SchemxComponentProps<T>>(
      (): SchemxComponentProps<T> => ({
        ...schema().componentProps,
        formItemProps: formItemProps.value,
        value: field.getValue(),
        readonly: schema().readonly,
        disabled: schema().disabled,
        placeholder: schema().placeholder,
        onChange: handleChange,
        onBlur: handleBlur,
        "onUpdate:value": (v) => field.setValue(v),
      })
    )

    /**
     * 渲染 required 星号。
     *
     * 当字段为必填且非详情展示/禁用/只读状态时，在 label 前显示红色星号标记。
     *
     * @returns 星号 VNode 或空片段
     */
    const renderRequired = (): VNodeChild => {
      if (!schema().required || schema().disabled || schema().readonly) {
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
        return labelSlot(formItemProps.value)
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
          ...formItemProps.value,
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
          ...formItemProps.value,
          errors: field.error.value,
        })
      }

      if (!Array.isArray(field.error.value) || field.error.value.length === 0) {
        return null
      }

      return <div class="schemx-item__error">{field.error.value[0]}</div>
    }

    return (): VNodeChild => {
      if (!schema().visible) {
        return null
      }

      // 整体插槽：完全接管渲染，不包裹任何默认结构
      const itemSlot = resolveSlot(slots, normalizeNameKey(schema().name))

      if (itemSlot) {
        return itemSlot(formItemProps.value)
      }

      const labelPosition = schema().labelPosition || formContext.labelPosition

      return (
        <div class={classnames("schemx-item-wrapper")}>
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
            style={{ ...(schema().style ?? {}) }}
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
  {
    name: "SchemxItem",

    props: {
      schema: {
        type: Object as PropType<SchemxViewSchema>,
        required: true,
      },
    },
  }
)

export default FormItem

const isViewGroupSchema = <T extends Values>(
  schema: SchemxViewSchema<T>
): schema is SchemxViewGroupSchema<T> => {
  return schema.componentType === "group"
}

const normalizeNameKey = (name: unknown): string => {
  if (Array.isArray(name)) {
    return name.map((part) => String(part)).join(".")
  }

  return String(name)
}
