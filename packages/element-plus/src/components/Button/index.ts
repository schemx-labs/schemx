import { defineComponent, h } from "vue"

import { ElButton } from "element-plus"

/**
 * 使用 Element Plus 自身的外观类型和尺寸，补充 Schemx 加载文案与插槽。
 */
export const ElementPlusButton = defineComponent({
  name: "SchemxElementPlusButton",
  inheritAttrs: false,
  props: {
    loadingText: { type: String, default: undefined },
  },

  /**
   * 保留按钮事件与扩展属性，并统一前后缀和加载文案。
   *
   * @param props - Element Plus 未提供的加载文案。
   * @param context - 按钮属性与插槽。
   * @example h(ElementPlusButton, { type: "primary", loading: true }, () => "保存")
   */
  setup(props, context) {
    // 使用 Vue 的实时 attrs 和 slots，支持配置更新。
    const { attrs, slots } = context

    return () => {
      return h(
        ElButton,
        {
          ...attrs,
        },
        {
          ...slots,
          default: () => [
            slots.prefix?.(),
            attrs.loading && props.loadingText ? props.loadingText : slots.default?.(),
            slots.suffix?.(),
          ],
        }
      )
    }
  },
})
