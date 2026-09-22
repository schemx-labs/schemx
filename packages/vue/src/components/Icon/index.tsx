/**
 * Icon 包装组件。
 *
 * 它允许 Schema 使用可序列化的字符串图标名称，也允许 Form 配置传入 Vue 组件。
 *
 * @module components/Icon
 */

import { defineComponent, h, markRaw, toRaw, useAttrs } from "vue"
import type { PropType } from "vue"

import type { SchemxIconComponent, SchemxIconValue } from "../../types/icon"

const Icon = defineComponent({
  name: "SchemxIcon",
  inheritAttrs: false,

  props: {
    icon: {
      type: [String, Object, Function] as PropType<SchemxIconValue>,
      required: true,
    },
    component: {
      type: [Object, Function] as PropType<SchemxIconComponent>,
      required: false,
      default: undefined,
    },
  },

  /**
   * 渲染直接传入的组件，或将字符串名称交给 Icon Adapter。
   *
   * @param props - 当前图标值及可选的 Adapter 组件。
   */
  setup(props) {
    const attrs = useAttrs()

    return () => {
      if (typeof props.icon !== "string") {
        return h(markRaw(toRaw(props.icon)) as SchemxIconComponent, attrs)
      }

      const adapter = props.component

      if (adapter === undefined) {
        return h(
          "span",
          { ...attrs, class: ["schemx-icon-text", attrs.class] },
          props.icon
        )
      }

      return h(markRaw(toRaw(adapter)), { ...attrs, icon: props.icon })
    }
  },
})

export default Icon
