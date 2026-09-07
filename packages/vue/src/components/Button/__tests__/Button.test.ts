import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"

import Button from "../index.vue"

describe("SchemxButton", () => {
  it("支持 loading、loadingText、disabled 和 size", async () => {
    const wrapper = mount(Button, {
      props: {
        loading: true,
        loadingText: "保存中",
        size: "large",
      },
      slots: {
        prefix: "前缀",
        default: "保存",
        suffix: "后缀",
      },
    })

    expect(wrapper.text()).toBe("前缀保存中后缀")
    expect(wrapper.attributes("disabled")).toBeDefined()
    expect(wrapper.attributes("aria-busy")).toBe("true")
    expect(wrapper.classes()).toContain("schemx-button--large")

    await wrapper.setProps({ loading: false, disabled: true })

    expect(wrapper.text()).toBe("前缀保存后缀")
    expect(wrapper.attributes("disabled")).toBeDefined()

    wrapper.unmount()
  })
})
