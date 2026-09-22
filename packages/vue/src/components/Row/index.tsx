/**
 * Row - Schema 列表行包装组件。
 *
 * 将 Form、Group 或 Dynamic 的同级节点交给配置的 UI Row 组件渲染；未传入组件时
 * 回退到 Vue 层内置的基础 flex 行容器。调用方可通过 `enabled` 明确关闭 Row。
 *
 * @module components/Row
 */

import { computed, defineComponent, h, markRaw, type PropType, toRaw } from "vue"
import type { ClassValue, StyleValue, VNodeChild } from "vue"

import { useOptionalFormContextValue } from "../../context/formContext"
import { normalizeSchemxGutter } from "../../utils/layout"

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

      return component ? markRaw(toRaw(component)) : undefined
    })

    return (): VNodeChild => {
      const component = resolvedComponent.value

      const row = props.row ?? {}

      const { gutter, justify, align, ...extensionProps } = row

      const { class: attrsClass, style: attrsStyle, ...restAttrs } = attrs

      const componentAttrs = {
        ...extensionProps,
        ...restAttrs,
      }

      const rowClassValue = ["schemx-row", attrsClass] as ClassValue[]

      const justifyContent =
        justify === "start" ? "flex-start" : justify === "end" ? "flex-end" : justify

      const alignItems =
        align === "top"
          ? "flex-start"
          : align === "middle"
            ? "center"
            : align === "bottom"
              ? "flex-end"
              : undefined

      const [gutterTop, gutterRight, gutterBottom, gutterLeft] =
        normalizeSchemxGutter(gutter)

      const paddingTop = gutterTop / 2

      const paddingRight = gutterRight / 2

      const paddingBottom = gutterBottom / 2

      const paddingLeft = gutterLeft / 2

      const internalRowStyle = [
        attrsStyle as StyleValue,
        {
          "--schemx-gutter-top": `${paddingTop}px`,
          "--schemx-gutter-right": `${paddingRight}px`,
          "--schemx-gutter-bottom": `${paddingBottom}px`,
          "--schemx-gutter-left": `${paddingLeft}px`,
          marginInline: `-${paddingRight}px -${paddingLeft}px`,
          justifyContent,
          alignItems,
        },
      ] as StyleValue

      if (!props.enabled) {
        return slots.default?.() ?? null
      }

      if (!component) {
        return (
          <div {...restAttrs} class={rowClassValue} style={internalRowStyle}>
            {slots.default?.()}
          </div>
        )
      }

      return h(
        component,
        {
          ...componentAttrs,
          gutter,
          justify,
          align,
          class: rowClassValue,
          style: internalRowStyle as StyleValue,
        },
        slots
      )
    }
  },
})

export default Row
