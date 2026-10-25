/**
 * Field
 *
 * schemx 实际渲染字段的组件。
 * 动态属性已由 core 解析到 ViewSchema 中；这里只负责消费
 * 已解析字段 schema、创建字段实例、组装渲染器属性与插槽。
 *
 * @module components/Field
 */

/* eslint-disable vue/one-component-per-file */
import {
  callWithAsyncErrorHandling,
  computed,
  defineComponent,
  ErrorCodes,
  getCurrentInstance,
} from "vue"
import type { ClassValue, PropType, SlotsType, StyleValue, VNodeChild } from "vue"

import { isSchemxViewFieldSchema } from "@schemx/core"
import classnames from "classnames"

import { useVueFormRuntime } from "../../bridge"
import { createFieldContext, useFormContextValue } from "../../context"
import {
  createFieldHook,
  useFieldScrollTarget,
  useStableRef,
  useViewSchema,
} from "../../hooks"
import { normalizeNameKey, resolveSlot } from "../../utils"
import Col from "../Col"

import { createFieldSlotRenderers } from "./index"

import type { SchemxFieldSlots } from "../../types"
import type {
  FieldValue,
  NamePath,
  SchemxComponentProps,
  SchemxViewFieldSchema,
  Values,
} from "@schemx/core"

/**
 * Field 属性。
 *
 * 提供待渲染的字段 ViewSchema。
 */
export interface SchemxFieldProps {
  /**
   * 当前字段的已解析 ViewSchema。
   */
  schema: unknown
  /**
   * 追加到字段外层包装器的 CSS 类名。
   */
  class?: ClassValue
  /**
   * 追加到字段外层包装器的内联样式。
   */
  style?: StyleValue
}

const Field = defineComponent({
  name: "SchemxField",
  inheritAttrs: false,

  props: {
    schema: {
      type: Object as PropType<unknown>,
      required: true,
    },
    class: {
      type: [String, Object, Array, Boolean] as PropType<ClassValue>,
      required: false,
      default: undefined,
    },
    style: {
      type: [String, Object, Array] as PropType<StyleValue>,
      required: false,
      default: undefined,
    },
  },

  slots: Object as SlotsType<SchemxFieldSlots>,

  /**
   * 初始化字段上下文，并组合响应式 schema、校验处理器与插槽渲染器。
   *
   * @param props - 当前字段项的 Schema、class 和 style。
   * @param setupContext - Vue setup 上下文，包含透传属性和字段插槽。
   */
  setup(props, setupContext) {
    const { attrs, slots } = setupContext

    const formContext = useFormContextValue<Values>()

    const form = formContext.form

    // Schema 与字段控制器复用当前 Field 的一个 Runtime owner。
    const runtime = useVueFormRuntime(form)

    const inputSchema = computed<SchemxViewFieldSchema<Values>>(
      () => props.schema as SchemxViewFieldSchema<Values>
    )

    // 按 key 复用表单级 ViewSchema 订阅，避免每个 Field 建立独立 Core effect。
    const latestSchema = useViewSchema(runtime, () => inputSchema.value.key)

    // 优先使用桥接中的最新字段；首帧或字段暂不存在时回退到输入 schema。
    const schemaRef = computed<SchemxViewFieldSchema<Values>>(() => {
      return latestSchema.value && isSchemxViewFieldSchema(latestSchema.value)
        ? latestSchema.value
        : inputSchema.value
    })

    const field = createFieldHook(runtime, schemaRef.value.name)

    createFieldContext(field)

    const isError = computed(() => field.errors.value.length > 0)

    // Renderer 不一定返回回调 Promise，Core 交互的异步错误在 Field 边界交给 Vue。
    const owner = getCurrentInstance()

    /**
     * 转发用户修改，由 Core 写值、标记 touched、调用 Schema 回调并安排校验。
     * Renderer 回调在同步提交后执行一次，不再另行调用 Schema 回调。
     *
     * @param value - 渲染器提交的最新字段值。
     */
    const handleChange = (value: FieldValue<Values, NamePath<Values>>): void => {
      // Schema 回调可能替换节点；本次 Renderer 回调仍属于事件开始时的组件。
      const rendererProps = schemaRef.value.componentProps

      callWithAsyncErrorHandling(
        () => field.change(value),
        owner,
        ErrorCodes.COMPONENT_EVENT_HANDLER
      )
      rendererProps?.onChange?.(value)
    }

    /**
     * 转发失焦，由 Core 标记 touched 和决定校验；Renderer 接收原事件参数。
     *
     * @param value - Renderer 传入的失焦值或事件，保持原样传给组件回调。
     */
    const handleBlur = (value: FieldValue<Values, NamePath<Values>>): void => {
      // 保留原事件所属组件的回调，避免转发到同步替换后的节点。
      const rendererProps = schemaRef.value.componentProps

      callWithAsyncErrorHandling(
        () => field.blur(),
        owner,
        ErrorCodes.COMPONENT_EVENT_HANDLER
      )
      rendererProps?.onBlur?.(value)
    }

    /**
     * 处理组件的 v-model 更新，只同步字段值，不主动触发校验。
     *
     * @param v - 渲染器提交的最新字段值。
     */
    const updateValue = (v: FieldValue<Values, NamePath<Values>>) => {
      field.setValue(v)
    }

    // 使用 useStableRef 避免每次生成新对象引用
    const componentProps = useStableRef<SchemxComponentProps<Values>>(
      (): SchemxComponentProps<Values> => {
        const currentComponentProps = schemaRef.value.componentProps ?? {}

        // 运行时从同一字段组装 value 与事件，在此恢复 Renderer Props 的类型关联。
        return {
          ...currentComponentProps,
          value: field.value.value,
          onChange: handleChange,
          onBlur: handleBlur,
          "onUpdate:value": updateValue,
        } as SchemxComponentProps<Values>
      }
    )

    const {
      createSlotProps,
      renderAfter,
      renderBefore,
      renderContent,
      renderError,
      renderLabel,
    } = createFieldSlotRenderers({
      schemaRef,
      field,
      form,
      formContext,
      componentProps,
      slots,
    })

    const setWrapperElement = useFieldScrollTarget({
      getName: () => schemaRef.value.name,
    })

    return (): VNodeChild => {
      if (schemaRef.value.visible === false) {
        return null
      }

      // 整体插槽只替换标签和控件主体，Before、Error、After 仍由 wrapper 渲染。
      const fieldSlot = resolveSlot(slots, normalizeNameKey(schemaRef.value.name))

      const labelPosition = schemaRef.value.labelPosition

      const fieldContent = fieldSlot ? (
        fieldSlot(createSlotProps())
      ) : (
        <div
          class={classnames("schemx-field", `schemx-field--label-${labelPosition}`, {
            "is-readonly": schemaRef.value.readonly,
            "is-disabled": schemaRef.value.disabled,
          })}
        >
          {renderLabel()}
          {renderContent()}
        </div>
      )

      const fieldWrapper = (
        <div
          {...attrs}
          ref={setWrapperElement}
          class={classnames(
            "schemx-field-wrapper",
            props.class,
            attrs.class,
            schemaRef.value.class,
            schemaRef.value.bordered ? "is-bordered" : "",
            isError.value ? "is-error" : ""
          )}
          style={[
            attrs.style,
            props.style,
            schemaRef.value.style,
            {
              "--schemx-content-align": schemaRef.value.contentAlign,
              "--schemx-error-align":
                schemaRef.value.errorAlign ??
                formContext.schemaConfig.errorAlign ??
                "left",
            },
          ]}
        >
          {renderBefore()}
          {fieldContent}
          {renderError()}
          {renderAfter()}
        </div>
      )

      return <Col col={schemaRef.value.col ?? schemaRef.value.layout}>{fieldWrapper}</Col>
    }
  },
})

export default Field

export { createFieldSlotRenderers } from "./slot"
