import { defineComponent, h } from "vue"

import { Button as VanButton } from "vant"

/**
 * 使用 Vant 自身的外观类型和尺寸，并保留 Schemx 前后缀插槽。
 */
export const VantButton = defineComponent({
  name: "SchemxVantButton",
  inheritAttrs: false,

  /**
   * 保留按钮事件、加载文案与扩展属性，并统一前后缀插槽。
   *
   * @param _props - 按钮配置通过 attrs 接收。
   * @param context - 按钮属性与插槽。
   * @example h(VantButton, { type: "primary", loading: true }, () => "保存")
   */
  setup(_props, context) {
    // 使用 Vue 的实时 attrs 和 slots，支持配置更新。
    const { attrs, slots } = context

    return () => {
      return h(
        VanButton,
        {
          ...attrs,
        },
        {
          ...slots,
          default: () => [slots.prefix?.(), slots.default?.(), slots.suffix?.()],
        }
      )
    }
  },
})
