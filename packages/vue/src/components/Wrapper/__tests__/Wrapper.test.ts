// @vitest-environment happy-dom

import { h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import Wrapper from "../index.vue"

describe("SchemxWrapper", () => {
  it("将 renderer 的 class、style 和 attrs 合并到唯一根节点", () => {
    const wrapper = mount(Wrapper, {
      attrs: {
        class: ["schemx-renderer", "schemx-input-renderer"],
        style: { color: "red" },
        "data-testid": "renderer-wrapper",
      },
      slots: { default: "内容" },
    })

    const root = wrapper.get('[data-testid="renderer-wrapper"]')

    expect(root.classes()).toEqual(
      expect.arrayContaining([
        "schemx-wrapper",
        "schemx-renderer",
        "schemx-input-renderer",
      ])
    )
    expect(root.attributes("style")).toContain("color: red")
    expect(root.text()).toBe("内容")
  })

  it("default 插槽接收 readonly 与 disabled 状态", () => {
    const wrapper = mount(Wrapper, {
      props: { disabled: true },
      slots: {
        default: ({ readonly, disabled }) =>
          h("span", { "data-testid": "state" }, `${readonly}/${disabled}`),
      },
    })

    expect(wrapper.get('[data-testid="state"]').text()).toBe("false/true")
    expect(wrapper.get(".schemx-wrapper").classes()).toContain("schemx-wrapper--disabled")
  })

  it("readonly 时卸载 default，仅渲染 #readonly", () => {
    const wrapper = mount(Wrapper, {
      props: { readonly: true },
      slots: {
        default: '<input data-testid="editor" />',
        readonly: ({ readonly, disabled }) =>
          h("span", { "data-testid": "readonly" }, `只读:${readonly}/${disabled}`),
      },
    })

    expect(wrapper.find('[data-testid="editor"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="readonly"]').text()).toBe("只读:true/false")
    expect(wrapper.get(".schemx-wrapper").classes()).toContain("schemx-wrapper--readonly")
  })

  it("readonly 缺少 #readonly 时渲染空内容并发出开发警告", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const wrapper = mount(Wrapper, {
      props: { readonly: true },
      slots: { default: "不应显示" },
    })

    expect(wrapper.get(".schemx-wrapper").text()).toBe("")
    expect(warn).toHaveBeenCalledWith(
      "[schemx] SchemxWrapper is readonly but no #readonly slot was provided."
    )

    warn.mockRestore()
    wrapper.unmount()
  })
})
