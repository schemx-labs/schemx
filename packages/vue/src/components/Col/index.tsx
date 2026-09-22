/**
 * Col - Schema 布局列包装组件。
 *
 * 将 Field 的静态 col 元数据转换为配置 UI 组件的 `span` 与 `offset` Props；
 * 未传入组件时使用 Vue 层内置的 24 栅格 Col 实现。
 *
 * @module components/Col
 */

import { computed, defineComponent, h, markRaw, type PropType, toRaw } from "vue"
import type { ClassValue, StyleValue, VNodeChild } from "vue"

import { useOptionalFormContextValue } from "../../context/formContext"

import type {
  SchemxColComponent,
  SchemxColConfig,
  SchemxLayout,
} from "../../types/layout"

const Col = defineComponent({
  name: "SchemxCol",
  inheritAttrs: false,

  props: {
    col: {
      type: Object as PropType<SchemxColConfig>,
      required: false,
      default: undefined,
    },
    /**
     * @deprecated 请在 Form 或 ConfigProvider 的 `colComponent` 中配置实现，见 {@link import("@schemx/core").SchemxConfig}。
     */
    component: {
      type: [Object, Function] as PropType<SchemxColComponent>,
      required: false,
      default: undefined,
    },
    /**
     * @deprecated 请改用 {@link import("../../types/layout").SchemxColProps.col}。
     */
    layout: {
      type: Object as PropType<SchemxLayout>,
      required: false,
      default: undefined,
    },
  },

  /**
   * 根据 Col 配置和当前 Form Context 创建列组件。
   *
   * @param props - 列配置及兼容期的组件覆写属性。
   * @param setupContext - 父级透传属性与默认插槽。
   */
  setup(props, setupContext) {
    const { attrs, slots } = setupContext

    const formContext = useOptionalFormContextValue()

    const resolvedComponent = computed(() => {
      const component = props.component ?? formContext?.colComponent

      return component ? markRaw(toRaw(component)) : undefined
    })

    return (): VNodeChild => {
      const component = resolvedComponent.value

      const col = props.col ?? props.layout ?? {}

      const {
        block,
        span: configuredSpan,
        offset: configuredOffset,
        ...extensionProps
      } = col

      const span = block ? 24 : (configuredSpan ?? 24)

      const offset = block ? 0 : (configuredOffset ?? 0)

      const { class: attrsClass, style: attrsStyle, ...restAttrs } = attrs

      if (!component) {
        const width = `${(span / 24) * 100}%`

        const marginLeft = `${(offset / 24) * 100}%`

        return h(
          "div",
          {
            ...restAttrs,
            class: ["schemx-col", attrsClass as ClassValue],
            style: [
              attrsStyle as StyleValue,
              {
                flex: `0 0 ${width}`,
                maxWidth: width,
                marginLeft,
                paddingTop: "var(--schemx-gutter-top, 0px)",
                paddingRight: "var(--schemx-gutter-right, 0px)",
                paddingBottom: "var(--schemx-gutter-bottom, 0px)",
                paddingLeft: "var(--schemx-gutter-left, 0px)",
              },
            ],
          },
          slots
        )
      }

      return h(
        component,
        {
          ...extensionProps,
          ...restAttrs,
          class: ["schemx-col", attrsClass as ClassValue],
          style: attrsStyle as StyleValue,
          span,
          offset,
        },
        slots
      )
    }
  },
})

export default Col
