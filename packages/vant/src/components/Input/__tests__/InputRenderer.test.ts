// @vitest-environment happy-dom

import { h } from "vue"

import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import InputRenderer from "../index.vue"

describe("InputRenderer 容器聚焦", () => {
  it("点击字数统计区域时聚焦输入框", async () => {
    const wrapper = mount(InputRenderer, {
      attachTo: document.body,
      props: {
        maxlength: 20,
        showWordLimit: true,
      },
    })

    await wrapper.get(".van-field__word-limit").trigger("click")

    expect(document.activeElement).toBe(wrapper.get("input").element)

    wrapper.unmount()
  })

  it("点击 button 插槽时不抢占焦点", async () => {
    const wrapper = mount(InputRenderer, {
      attachTo: document.body,
      slots: {
        button: () => h("button", { type: "button" }, "操作"),
      },
    })

    const button = wrapper.get("button")

    await button.trigger("click")

    expect(document.activeElement).not.toBe(wrapper.get("input").element)

    wrapper.unmount()
  })

  it("点击 extra 插槽中的普通文本时聚焦输入框", async () => {
    const wrapper = mount(InputRenderer, {
      attachTo: document.body,
      slots: {
        extra: () => h("span", { "data-testid": "extra-text" }, "补充说明"),
      },
    })

    await wrapper.get('[data-testid="extra-text"]').trigger("click")

    expect(document.activeElement).toBe(wrapper.get("input").element)

    wrapper.unmount()
  })

  it("点击 extra 插槽中的按钮时不抢占焦点", async () => {
    const wrapper = mount(InputRenderer, {
      attachTo: document.body,
      slots: {
        extra: () => h("button", { type: "button" }, "额外操作"),
      },
    })

    const button = wrapper.get("button")

    await button.trigger("click")

    expect(document.activeElement).not.toBe(wrapper.get("input").element)

    wrapper.unmount()
  })
})
