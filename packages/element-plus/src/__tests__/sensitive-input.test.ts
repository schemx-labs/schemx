// @vitest-environment happy-dom

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import SensitiveInputRenderer from "../renderers/SensitiveInputRenderer"

describe("SensitiveInputRenderer", () => {
  it("默认传入 value 并显示脱敏值", () => {
    const wrapper = mount(SensitiveInputRenderer, {
      props: {
        value: "13812348899",
        maskFormatter: (value: string) => `${value.slice(0, 3)}****${value.slice(-4)}`,
      },
    })

    expect(wrapper.text()).toContain("138****8899")
    expect(wrapper.find("input").exists()).toBe(false)

    wrapper.unmount()
  })

  it("展开后显示输入框并将新值回传", async () => {
    const onChange = vi.fn()

    const wrapper = mount(SensitiveInputRenderer, {
      props: {
        value: "13812348899",
        onChange,
      },
    })

    await wrapper.get('[data-testid="sensitive-toggle"]').trigger("click")
    await wrapper.get("input").setValue("13900001111")

    expect(onChange).toHaveBeenCalledWith("13900001111")

    wrapper.unmount()
  })

  it("readonly 且允许展示时显示完整值但不渲染输入框", async () => {
    const wrapper = mount(SensitiveInputRenderer, {
      props: {
        value: "sensitive-value",
        readonly: true,
        revealWhenReadonly: true,
      },
    })

    await wrapper.get('[data-testid="sensitive-toggle"]').trigger("click")

    expect(wrapper.text()).toContain("sensitive-value")
    expect(wrapper.find("input").exists()).toBe(false)

    wrapper.unmount()
  })

  it("空值直接显示输入框且不显示展开按钮", () => {
    const wrapper = mount(SensitiveInputRenderer, {
      props: { value: "" },
    })

    expect(wrapper.find("input").exists()).toBe(true)
    expect(wrapper.find('[data-testid="sensitive-toggle"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it("开启 hideOnBlur 后失焦恢复脱敏展示", async () => {
    const wrapper = mount(SensitiveInputRenderer, {
      props: {
        value: "sensitive-value",
        hideOnBlur: true,
      },
    })

    await wrapper.get('[data-testid="sensitive-toggle"]').trigger("click")
    await wrapper.get("input").trigger("blur")

    expect(wrapper.find("input").exists()).toBe(false)
    expect(wrapper.text()).not.toContain("sensitive-value")

    wrapper.unmount()
  })
})
