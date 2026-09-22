/**
 * Vant 默认 Row 定义。
 *
 * 由 Vant 适配包 Runtime 作为默认布局行组件使用。
 *
 * @module layout/defaultRow
 */

import { defineComponent, h } from "vue"

import { Row as VanRow } from "vant"

import { normalizeSchemxGutter } from "@schemx/vue"

import type { SchemxGutter } from "@schemx/vue"

/**
 * Vant Row 包装器：将四边 gutter 转为子项内边距和行负边距，并保留 Vant 的 Row 行为。
 */
export const VantRow = defineComponent({
  name: "SchemxVantRow",
  inheritAttrs: false,
  /**
   * 将 Vue Row 配置适配为 Vant Row Props 和 Schemx gutter 样式。
   *
   * @param _props - VantRow 不声明组件 Props；配置通过 attrs 接收。
   * @param setupContext - 父级透传的属性和默认插槽。
   */
  setup(_props, setupContext) {
    const { attrs, slots } = setupContext

    return () => {
      const { gutter, class: attrsClass, style: attrsStyle, ...restAttrs } = attrs

      const rowAttrs = { ...restAttrs }

      const align = rowAttrs.align

      const justify = rowAttrs.justify

      const [top, right, bottom, left] = normalizeSchemxGutter(
        gutter as SchemxGutter | undefined
      )

      const halfTop = top / 2

      const halfRight = right / 2

      const halfBottom = bottom / 2

      const halfLeft = left / 2

      if (align === "middle") {
        rowAttrs.align = "center"
      }

      const style = [
        attrsStyle,
        {
          "--schemx-gutter-top": `${halfTop}px`,
          "--schemx-gutter-right": `${halfRight}px`,
          "--schemx-gutter-bottom": `${halfBottom}px`,
          "--schemx-gutter-left": `${halfLeft}px`,
          margin: `-${halfTop}px -${halfRight}px -${halfBottom}px -${halfLeft}px`,
          ...(justify === "space-evenly" ? { justifyContent: "space-evenly" } : {}),
        },
      ]

      return h(VanRow, { ...rowAttrs, class: attrsClass, gutter: 0, style }, slots)
    }
  },
})
