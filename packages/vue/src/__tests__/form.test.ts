import { defineComponent, h, markRaw, nextTick } from "vue"

import { createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import SchemxForm from "../form.vue"

const InputRenderer = defineComponent({
  name: "InputRenderer",
  setup() {
    return () => h("input", { "data-testid": "input-renderer" })
  },
})

describe("SchemxForm 动态 schemas", () => {
  it("外部 schemas prop 更新后同步 ViewSchemas", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          { name: "name", label: "姓名", componentType: "input" },
        ],
      },
    })

    await nextTick()

    expect(wrapper.text()).toContain("姓名")
    expect(wrapper.text()).not.toContain("年龄")

    await wrapper.setProps({
      schemas: [
        { name: "name", label: "姓名", componentType: "input" },
        { name: "age", label: "年龄", componentType: "input" },
      ],
    })
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(wrapper.text()).toContain("姓名")
    expect(wrapper.text()).toContain("年龄")

    wrapper.unmount()
  })

  it("只按顶层可见非 group 字段标记首尾样式类", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          {
            componentType: "group",
            label: "分组一",
            children: [{ name: "city", label: "城市", componentType: "input" }],
          },
          { name: "name", label: "姓名", componentType: "input" },
          {
            componentType: "group",
            label: "分组二",
            children: [{ name: "street", label: "街道", componentType: "input" }],
          },
          { name: "age", label: "年龄", componentType: "input" },
        ],
      },
    })

    await nextTick()

    const root = wrapper.get(".schemx").element
    const directItemWrappers = Array.from(root.children).filter((element) =>
      element.classList.contains("schemx-item-wrapper")
    )

    expect(directItemWrappers).toHaveLength(2)
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--last")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--first")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )

    const groupItemWrappers = wrapper.findAll(".schemx-group__body .schemx-item-wrapper")
    expect(groupItemWrappers).toHaveLength(2)
    for (const itemWrapper of groupItemWrappers) {
      expect(itemWrapper.classes()).not.toContain("schemx-item-wrapper--first")
      expect(itemWrapper.classes()).not.toContain("schemx-item-wrapper--last")
    }

    wrapper.unmount()
  })

  it("查找首尾样式类时跳过当前项前后的 group 和不可见字段", async () => {
    const rendererRegistry = createRendererRegistry()
    rendererRegistry.register("input", markRaw(InputRenderer))

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry,
        schemas: [
          {
            componentType: "group",
            label: "前置分组",
            children: [{ name: "city", label: "城市", componentType: "input" }],
          },
          { name: "hiddenBefore", label: "隐藏前项", componentType: "input", visible: false },
          { name: "name", label: "姓名", componentType: "input" },
          {
            componentType: "group",
            label: "中间分组",
            children: [{ name: "street", label: "街道", componentType: "input" }],
          },
          { name: "age", label: "年龄", componentType: "input" },
          { name: "hiddenAfter", label: "隐藏后项", componentType: "input", visible: false },
          {
            componentType: "group",
            label: "后置分组",
            children: [{ name: "postcode", label: "邮编", componentType: "input" }],
          },
        ],
      },
    })

    await nextTick()

    const root = wrapper.get(".schemx").element
    const directItemWrappers = Array.from(root.children).filter((element) =>
      element.classList.contains("schemx-item-wrapper")
    )

    expect(directItemWrappers).toHaveLength(2)
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--first")).toBe(
      true
    )
    expect(directItemWrappers[0].classList.contains("schemx-item-wrapper--last")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--first")).toBe(
      false
    )
    expect(directItemWrappers[1].classList.contains("schemx-item-wrapper--last")).toBe(
      true
    )

    wrapper.unmount()
  })
})
