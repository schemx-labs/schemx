/**
 * Row - Schema 列表行包装组件。
 *
 * 将 Form、Group 或 Dynamic 的同级节点交给配置的 UI Row 组件渲染；未传入组件时
 * 回退到 Vue 层内置的基础 flex 行容器。调用方可通过 `enabled` 明确关闭 Row。
 *
 * @module components/Row
 */

import { computed, defineComponent, h, markRaw, type PropType, toRaw } from "vue"
import type { ClassValue, VNodeChild } from "vue"

import { useOptionalFormContextValue } from "../../context/formContext"

import DefaultRow from "./default.vue"

import type { SchemxRowConfig } from "../../types/layout"

const Row = defineComponent({
  name: "SchemxRow",
  inheritAttrs: false,

  props: {
    row: {
      type: Object as PropType<SchemxRowConfig>,
      required: false,
      default: undefined,
    },
    enabled: {
      type: Boolean,
      required: false,
      default: true,
    },
  },

  /**
   * 根据 Row 配置和当前 Form Context 创建行容器。
   *
   * @param props - Row 配置与启用状态。
   * @param setupContext - 父级透传属性与默认插槽。
   */
  setup(props, setupContext) {
    const { attrs, slots } = setupContext

    const formContext = useOptionalFormContextValue()

    const resolvedComponent = computed(() => {
      const component = formContext?.rowComponent

      return component ? markRaw(toRaw(component)) : DefaultRow
    })

    return (): VNodeChild => {
      if (!props.enabled) {
        return slots.default?.() ?? null
      }

      const row = props.row ?? {}

      const { gutter, justify, align, ...extensionProps } = row

      const { class: attrsClass, style: attrsStyle, ...restAttrs } = attrs

      const componentAttrs = {
        ...extensionProps,
        ...restAttrs,
      }

      const rowClassValue = ["schemx-row", attrsClass] as ClassValue[]

      return h(
        resolvedComponent.value,
        {
          ...componentAttrs,
          gutter,
          justify,
          align,
          class: rowClassValue,
          style: attrsStyle,
        },
        slots
      )
    }
  },
})

export default Row
