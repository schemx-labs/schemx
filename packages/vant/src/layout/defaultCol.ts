/**
 * Vant 默认 Col 定义。
 *
 * 由 `config/defaultConfig` 设置为 Vant 适配包的模块级默认列组件；行布局由 VantRow 提供。
 *
 * @module layout/defaultCol
 */

import { defineComponent, h } from "vue"

import { Col as VanCol } from "vant"

/**
 * Vant 列的间距适配不依赖 Vue 内部组件的样式。
 */
export const VantCol = defineComponent({
  name: "SchemxVantCol",
  inheritAttrs: false,
  /**
   * 将四边 gutter 变量应用到适配器自身。
   * @param _props - 布局属性通过 attrs 接收。
   * @param context - 调用方属性和插槽。
   * @example h(VantCol, { span: 12 }, () => "内容")
   */
  setup(_props, context) {
    const { attrs, slots } = context

    return () =>
      h(
        VanCol,
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
