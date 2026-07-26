// @vitest-environment happy-dom

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import SchemxCell from "../index.vue"

describe("SchemxCell", () => {
  it("disabled 状态不展示可点击态且不触发 click", async () => {
    const wrapper = mount(SchemxCell, {
      props: {
        disabled: true,
        value: "已选择",
        onClick: vi.fn(),
      },
    })

    const cell = wrapper.get(".schemx-cell")

    expect(cell.classes()).toContain("schemx-cell--disabled")
    expect(cell.classes()).not.toContain("schemx-cell--clickable")
    expect(cell.attributes("aria-disabled")).toBe("true")
    expect(cell.attributes("tabindex")).toBeUndefined()

    await cell.trigger("click")

    expect(wrapper.emitted("click")).toBeUndefined()
  })

  it("保留数值 0 展示", () => {
    const wrapper = mount(SchemxCell, {
      props: {
        value: 0,
        placeholder: "请选择",
      },
    })

    expect(wrapper.get(".schemx-cell__value").text()).toBe("0")
  })

  it("readonly 空值时展示 readonlyPlaceholder", () => {
    const wrapper = mount(SchemxCell, {
      props: {
        readonly: true,
        placeholder: "请选择",
        readonlyPlaceholder: "-",
      },
    })

    expect(wrapper.get(".schemx-cell__value").text()).toBe("-")
  })

  it("readonly 有值时展示当前值", () => {
    const wrapper = mount(SchemxCell, {
      props: {
        readonly: true,
        value: "已选择",
        readonlyPlaceholder: "-",
      },
    })

    expect(wrapper.get(".schemx-cell__value").text()).toBe("已选择")
  })

  it("editable 状态展示可点击态并触发 click", async () => {
    const onClick = vi.fn()

    const wrapper = mount(SchemxCell, {
      props: {
        value: "请选择",
        onClick,
      },
    })

    const cell = wrapper.get(".schemx-cell")

    expect(cell.classes()).toContain("schemx-cell--clickable")
    expect(cell.attributes("role")).toBe("button")
    expect(cell.attributes("tabindex")).toBe("0")

    await cell.trigger("click")

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("通过 prop 展示 prefix 和 suffix", () => {
    const wrapper = mount(SchemxCell, {
      props: {
        prefix: "起",
        value: "10",
        suffix: "元",
      },
    })

    expect(wrapper.get(".schemx-cell__prefix").text()).toBe("起")
    expect(wrapper.get(".schemx-cell__value").text()).toBe("10")
    expect(wrapper.get(".schemx-cell__suffix").text()).toBe("元")
  })

  it("通过 slot 覆盖 prefix 和 suffix", () => {
    const wrapper = mount(SchemxCell, {
      props: {
        prefix: "prop-prefix",
        value: "内容",
        suffix: "prop-suffix",
      },
      slots: {
        prefix: '<span data-test="prefix-slot">slot-prefix</span>',
        suffix: '<span data-test="suffix-slot">slot-suffix</span>',
      },
    })

    expect(wrapper.get("[data-test='prefix-slot']").text()).toBe("slot-prefix")
    expect(wrapper.get("[data-test='suffix-slot']").text()).toBe("slot-suffix")
    expect(wrapper.text()).not.toContain("prop-prefix")
    expect(wrapper.text()).not.toContain("prop-suffix")
  })

  it("组件源码不依赖 Vant Cell", () => {
    const source = readFileSync(resolve(__dirname, "../index.vue"), "utf-8")

    expect(source).not.toContain('from "vant"')
    expect(source).not.toMatch(/<Cell[\s>]/)
  })
})
