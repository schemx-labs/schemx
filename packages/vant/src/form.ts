import { defineComponent, h } from "vue"
import type { App, ComponentPublicInstance } from "vue"

import VueForm, {
  Field,
  provideSchemxAppConfig,
  provideSchemxFormRuntime,
} from "@schemx/vue"

import { schemx } from "./schemx"

import type { Values } from "@schemx/core"
import type { SchemxFormPlugin, SchemxInstallOptions } from "@schemx/vue"

// 仅绑定本包创建器；基础 Form 负责 Props、插槽、状态和生命周期。
const Form = defineComponent({
  name: "VantSchemxForm",
  inheritAttrs: false,
  emits: ["update:modelValue"],
  setup(_, { attrs, slots, emit, expose }) {
    provideSchemxFormRuntime(schemx.createForm)
    const exposed = {}

    expose(exposed)

    // 内层挂载时同步填入完整 API，父组件 mounted 即可使用 ref。
    const setFormRef = (instance: Element | ComponentPublicInstance | null): void => {
      if (instance !== null) {
        Object.assign(exposed, instance)
      }
    }

    return () =>
      h(
        VueForm,
        {
          ...attrs,
          ref: setFormRef,
          "onUpdate:modelValue": (value: Values) => emit("update:modelValue", value),
        },
        slots
      )
  },
})

/**
 * 安装本包组件；显式配置作用于当前 App，省略时保留已有配置。
 * @param app - 目标 Vue App。
 * @param options - 当前 App 的共享配置。
 * @example app.use(SchemxForm, { schemaConfig: { labelWidth: 140 } })
 */
function install(app: App, options?: SchemxInstallOptions): void {
  if (options !== undefined) {
    provideSchemxAppConfig(app, options)
  }

  app.component("SchemxForm", Form)
}

// 保留基础 Form 的泛型消费契约，插件属性只添加到本包组件。
const plugin: Pick<SchemxFormPlugin, "install" | "Field"> = Object.assign(Form, {
  install,
  Field,
})

export default plugin as SchemxFormPlugin
