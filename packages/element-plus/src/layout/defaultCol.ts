/**
 * Element Plus 默认 Col 定义。
 *
 * 由 Element Plus 适配包 Runtime 作为默认布局列组件使用，并负责适配四边 gutter。
 *
 * @module layout/defaultCol
 */

import { defineComponent, h } from "vue"

import { ElCol } from "element-plus"

/**
 * Element Plus 列的间距适配不依赖 Vue 内部组件的样式。
 */
export const ElementPlusCol = defineComponent({
  name: "SchemxElementPlusCol",
  inheritAttrs: false,
  /**
   * 将四边 gutter 变量应用到适配器自身。
   * @param _props - 布局属性通过 attrs 接收。
   * @param context - 调用方属性和插槽。
   * @example h(ElementPlusCol, { span: 12 }, () => "内容")
   */
  setup(_props, context) {
    const { attrs, slots } = context

    return () =>
      h(
        ElCol,
        {
          ...attrs,
          style: [
            attrs.style,
            {
              paddingTop: "var(--schemx-gutter-top, 0px)",
              paddingRight: "var(--schemx-gutter-right, 0px)",
              paddingBottom: "var(--schemx-gutter-bottom, 0px)",
              paddingLeft: "var(--schemx-gutter-left, 0px)",
            },
          ],
        },
        slots
      )
  },
})
