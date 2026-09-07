/**
 * Col - Schema 布局列包装组件。
 *
 * 将 Core 的静态 layout 元数据转换为已注册 UI 组件的 `span` 与 `offset` Props；
 * 未注册组件时保持透明渲染，避免改变未启用布局的表单 DOM。
 *
 * @module components/Col
 */

import { computed, defineComponent, h, markRaw, type PropType, toRaw } from "vue"
import type { ClassValue, StyleValue, VNodeChild } from "vue"

import { registeredColComponent } from "../../utils/colProvider"

import type { SchemxColComponent } from "../../types/layout"
import type { SchemxLayout } from "@schemx/core"

const Col = defineComponent({
  name: "SchemxCol",
  inheritAttrs: false,

  props: {
    layout: {
      type: Object as PropType<SchemxLayout>,
      required: false,
      default: undefined,
    },
    component: {
      type: [Object, Function] as PropType<SchemxColComponent>,
      required: false,
      default: undefined,
    },
  },

  setup(props, { attrs, slots }) {
    const resolvedComponent = computed(() => {
      const component = props.component ?? registeredColComponent.value

      return component ? markRaw(toRaw(component)) : undefined
    })

    return (): VNodeChild => {
      const component = resolvedComponent.value

      if (!component) {
        return slots.default?.() ?? null
      }

      const layout = props.layout ?? {}

      const span = layout.block ? 24 : (layout.span ?? 24)

      const offset = layout.block ? 0 : (layout.offset ?? 0)

      const { class: attrsClass, style: attrsStyle, ...restAttrs } = attrs

      return h(
        component,
        {
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
