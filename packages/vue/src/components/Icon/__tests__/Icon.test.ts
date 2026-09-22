// @vitest-environment happy-dom

import { defineComponent, h, markRaw } from "vue"

import { createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import Schemx from "../../../form"
import SchemxForm from "../../../form.vue"
import ConfigProvider from "../../ConfigProvider"
import Icon from "../index"

const AdapterIcon = defineComponent({
  name: "AdapterIcon",
  props: { icon: String },
  setup(props) {
    return () => h("i", { "data-testid": "adapter-icon" }, props.icon)
  },
})

const DirectIcon = defineComponent({
  name: "DirectIcon",
  setup() {
    return () => h("i", { "data-testid": "direct-icon" }, "direct")
  },
})

const InputRenderer = defineComponent({
  name: "InputRenderer",
  setup() {
    return () => h("input")
  },
})

const AppIcon = defineComponent({
  name: "AppIcon",
  props: { icon: String },
  setup(props) {
    return () => h("i", { "data-testid": "app-icon" }, props.icon)
  },
})

const ProviderIcon = defineComponent({
  name: "ProviderIcon",
  props: { icon: String },
  setup(props) {
    return () => h("i", { "data-testid": "provider-icon" }, props.icon)
  },
})

const FormIcon = defineComponent({
  name: "FormIcon",
  props: { icon: String },
  setup(props) {
    return () => h("i", { "data-testid": "form-icon" }, props.icon)
  },
})

const createFormRendererRegistry = () => {
  const rendererRegistry = createRendererRegistry("input")

  rendererRegistry.register("input", markRaw(InputRenderer))

  return rendererRegistry
}

describe("SchemxIcon", () => {
  it("将字符串 icon 传给显式 Icon Adapter", () => {
    const wrapper = mount(Icon, {
      props: { icon: "info", component: AdapterIcon },
    })

    expect(wrapper.get("[data-testid='adapter-icon']").text()).toBe("info")
  })

  it("直接渲染 Component 类型的 icon", () => {
    const wrapper = mount(Icon, {
      props: { icon: markRaw(DirectIcon), component: AdapterIcon },
    })

    expect(wrapper.find("[data-testid='direct-icon']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='adapter-icon']").exists()).toBe(false)
  })

  it("未配置 Adapter 时回退为普通文本", () => {
    const wrapper = mount(Icon, {
      props: { icon: "info" },
    })

    expect(wrapper.get(".schemx-icon-text").text()).toBe("info")
  })

  it("按 Form、Provider 和 App 配置解析 Icon Adapter", () => {
    const rendererRegistry = createFormRendererRegistry()

    const wrapper = mount(ConfigProvider, {
      props: { iconComponent: ProviderIcon },
      global: {
        plugins: [[Schemx, { iconComponent: AppIcon }]],
      },
      slots: {
        default: () =>
          h(SchemxForm, {
            iconComponent: FormIcon,
            rendererRegistry,
            schemas: [
              {
                name: "name",
                label: "姓名",
                labelIcon: "info",
                componentType: "input",
              },
            ],
          }),
      },
    })

    expect(wrapper.get("[data-testid='form-icon']").text()).toBe("info")

    wrapper.unmount()
  })

  it("没有 Form 显式配置时使用 Provider Icon Adapter", () => {
    const wrapper = mount(ConfigProvider, {
      props: { iconComponent: ProviderIcon },
      global: {
        plugins: [[Schemx, { iconComponent: AppIcon }]],
      },
      slots: {
        default: () =>
          h(SchemxForm, {
            rendererRegistry: createFormRendererRegistry(),
            schemas: [
              {
                name: "name",
                label: "姓名",
                labelIcon: "info",
                componentType: "input",
              },
            ],
          }),
      },
    })

    expect(wrapper.get("[data-testid='provider-icon']").text()).toBe("info")

    wrapper.unmount()
  })

  it("没有 Form 和 Provider 配置时使用 App Icon Adapter", () => {
    const wrapper = mount(SchemxForm, {
      global: {
        plugins: [[Schemx, { iconComponent: AppIcon }]],
      },
      props: {
        rendererRegistry: createFormRendererRegistry(),
        schemas: [
          {
            name: "name",
            label: "姓名",
            labelIcon: "info",
            componentType: "input",
          },
        ],
      },
    })

    expect(wrapper.get("[data-testid='app-icon']").text()).toBe("info")

    wrapper.unmount()
  })
})
