import { defineComponent, h, markRaw, nextTick } from "vue"

import { createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import SchemxForm from "../form.vue"

import type { RendererPropsTransformer } from "@schemx/core"

const CITIES = [
  { label: "杭州", value: "HZ" },
  { label: "宁波", value: "NB" },
]

/**
 * 记录收到的 options / loading 的探针渲染器。
 */
const SelectProbe = defineComponent({
  name: "SelectProbe",
  props: {
    options: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h("div", {
        "data-testid": "probe",
        "data-options": JSON.stringify(props.options),
        "data-loading": String(props.loading),
      })
  },
})

/**
 * 挂载一个带字典配置的 select 字段。
 * @param api - 返回远端选项的请求函数。
 * @param immediate - 首次自动加载策略，缺省由 Core 按 true 处理。
 * @param transformProps - Renderer 可选的最终 Props 转换。
 */
function mountForm(
  api: () => Promise<typeof CITIES>,
  immediate?: boolean,
  transformProps?: RendererPropsTransformer
) {
  const registry = createRendererRegistry()

  const component = markRaw(SelectProbe)

  registry.register("select", transformProps ? { component, transformProps } : component)

  return mount(SchemxForm, {
    props: {
      rendererRegistry: registry,
      initialValues: { city: "" },
      schemas: [
        {
          name: "city",
          label: "城市",
          componentType: "select",
          dict: { api, immediate },
        },
      ],
    } as never,
  })
}

/**
 * 等待字典请求与 Vue 更新落地。
 */
async function flush(): Promise<void> {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe("字段字典注入", () => {
  it("immediate false 的字段即使渲染也不自动加载", async () => {
    // 由 Core 决定加载策略，Vue 渲染不得覆盖它。
    const api = vi.fn(async () => CITIES)

    // 明确禁用首次自动加载。
    const wrapper = mountForm(api, false)

    await flush()
    expect(api).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="probe"]').attributes("data-options")).toBe("[]")
    wrapper.unmount()
  })

  it("Field 直接呈现 Core 投影的字典选项，且只请求一次", async () => {
    const api = vi.fn(async () => CITIES)

    const wrapper = mountForm(api)

    await flush()

    // Vue 通过 Core 的 ViewSchema 防抖订阅接收异步结果。
    await vi.waitFor(() => {
      const probe = wrapper.get('[data-testid="probe"]')

      expect(probe.attributes("data-options")).toBe(JSON.stringify(CITIES))
      expect(probe.attributes("data-loading")).toBe("false")
    })
    expect(api).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it("transformProps 接收字典投影并可以转换最终选项", async () => {
    // 转换器通过最终选项生成一个只包含首项的列表。
    const wrapper = mountForm(
      async () => CITIES,
      undefined,
      (props) => {
        const options = "options" in props ? props.options : undefined

        return { ...props, options: Array.isArray(options) ? options.slice(0, 1) : [] }
      }
    )

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="probe"]').attributes("data-options")).toBe(
        JSON.stringify(CITIES.slice(0, 1))
      )
    })

    wrapper.unmount()
  })

  it("未配置字段字典时保留组件提供的静态选项", async () => {
    const registry = createRendererRegistry()

    registry.register("select", markRaw(SelectProbe))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: registry,
        initialValues: { city: "" },
        schemas: [
          {
            name: "city",
            label: "城市",
            componentType: "select",
            componentProps: { options: CITIES },
          },
        ],
      },
    } as never)

    await flush()

    const probe = wrapper.get('[data-testid="probe"]')

    expect(probe.attributes("data-options")).toBe(JSON.stringify(CITIES))

    wrapper.unmount()
  })
})
