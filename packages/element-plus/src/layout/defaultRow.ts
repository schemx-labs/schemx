/**
 * Element Plus 默认 Row 定义。
 *
 * 由 Element Plus 适配包 Runtime 作为默认布局行组件使用。
 *
 * @module layout/defaultRow
 */

import { defineComponent, h } from "vue"

import { normalizeSchemxGutter } from "@schemx/vue"
import { ElRow } from "element-plus"

import type { SchemxGutter } from "@schemx/vue"

export const ElementPlusRow = defineComponent({
  name: "SchemxElementPlusRow",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => {
      const { gutter, class: attrsClass, style: attrsStyle, ...restAttrs } = attrs

      const [top, right, bottom, left] = normalizeSchemxGutter(
        gutter as SchemxGutter | undefined
      )

      const halfTop = top / 2

      const halfRight = right / 2

      const halfBottom = bottom / 2

      const halfLeft = left / 2

      return h(
        ElRow,
        {
          ...restAttrs,
          class: attrsClass,
          gutter: 0,
          style: [
            attrsStyle,
            {
              "--schemx-gutter-top": `${halfTop}px`,
              "--schemx-gutter-right": `${halfRight}px`,
              "--schemx-gutter-bottom": `${halfBottom}px`,
              "--schemx-gutter-left": `${halfLeft}px`,
              margin: `-${halfTop}px -${halfRight}px -${halfBottom}px -${halfLeft}px`,
            },
          ],
        },
        slots
      )
    }
  },
})
