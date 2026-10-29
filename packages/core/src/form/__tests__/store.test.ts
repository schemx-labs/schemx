import { describe, expect, it, vi } from "vite-plus/test"

import { getFormStateAdapterContext } from "../../adapter/formStateAdapter/context"
import { createForm } from "../../createForm"
import { createStore } from "../../store"
import { createFormStore } from "../store"

describe("Form Store 域", () => {
  it("只公开消费端方法并保留接收者绑定", () => {
    // 原始 Store 的内部状态不能随域 API 公开。
    const store = createStore({ initialValues: { name: "Alice" } })

    const { api } = createFormStore({ store })

    try {
      expect(api).not.toHaveProperty("state")
      expect(api).not.toHaveProperty("destroy")
      expect(api).not.toHaveProperty("registerFieldPath")
      const { setFieldValue, getFieldValue } = api

      setFieldValue("name", "Bob")
      expect(getFieldValue("name")).toBe("Bob")
      api.reset()
      expect(getFieldValue("name")).toBe("Alice")
    } finally {
      store.destroy()
    }
  })

  it("原始资源操作保留语义，Form 创建的 API 独立适配", () => {
    // 相同状态通过原生动作和公开 API 使用不同的错误协议。
    const onReset = vi.fn()

    const form = createForm({ initialValues: { name: "Alice" }, onReset })

    // 原始动作由适配器上下文提供，公开实例仍保持消费端契约。
    const { store } = getFormStateAdapterContext(form)

    try {
      store.setFieldErrors("name", [{ type: "external", message: "invalid" }])
      expect(store.peekFieldErrors("name")).toEqual([
        { type: "external", message: "invalid" },
      ])
      expect(form.getFieldErrors("name")).toEqual(["invalid"])

      store.reset({ name: "Bob" })
      expect(store.getFieldValue("name")).toBe("Bob")
      expect(onReset).not.toHaveBeenCalled()
      expect(store.peekFieldErrors("name")).toHaveLength(1)

      form.reset()
      expect(onReset).toHaveBeenCalledTimes(1)
      expect(store.peekFieldErrors("name")).toEqual([])
    } finally {
      form.destroy()
    }
  })

  it("Form 拥有副作用作用域并在销毁时停止 effect", () => {
    const form = createForm({ initialValues: { name: "Alice" } })

    // 次数用于观察 Form 创建的作用域是否停止了订阅。
    let runs = 0

    form.effect(() => {
      form.getFieldValue("name")
      runs++
    })
    expect(runs).toBe(1)
    form.destroy()
    form.setFieldValue("name", "Bob")
    expect(runs).toBe(1)
  })
})
