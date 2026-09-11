/**
 * Form 重置回调与提交 loading 测试。
 *
 * @module core/__tests__/formCallbacks
 */

import { describe, expect, it, vi } from "vitest"

import { createFormStateAdapter } from "../adapter"
import { createForm } from "../createForm"

import type { SchemxFormApi } from "../types"

/**
 * 创建可由测试主动完成的 Promise。
 *
 * @returns Promise 及其完成函数。
 */
function createDeferred(): {
  promise: Promise<void>
  resolve(): void
} {
  let resolvePromise: (() => void) | undefined

  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: () => {
      resolvePromise?.()
    },
  }
}

describe("Form reset callbacks", () => {
  it("完整 reset 完成后触发 onReset，resetFields 不触发", () => {
    const onReset = vi.fn()

    const form = createForm({
      initialValues: { name: "Ada", age: 20 },
      onReset,
    })

    form.setFieldValue("name", "Grace")
    form.setFieldTouched("name", true)
    form.setFieldErrors("name", ["无效名称"])
    form.setFieldPending("name", true, "保存中")
    form.resetFields(["name"])

    expect(onReset).not.toHaveBeenCalled()

    form.reset()

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(form.getFieldsValue()).toEqual({ name: "Ada", age: 20 })
    expect(form.getFieldErrors("name")).toEqual([])
    expect(form.isFieldTouched("name")).toBe(false)
    expect(form.isFieldPending("name")).toBe(false)

    form.destroy()
  })

  it("动态 Renderer 的 formApi.reset 也触发 onReset", async () => {
    const onReset = vi.fn()

    let formApi: SchemxFormApi<{ name: string }> | undefined

    const form = createForm<{ name: string }>({
      initialValues: { name: "Ada" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          dependencies: {
            triggerFields: ["name"],
            trigger: (
              _values: { name: string },
              nextFormApi: SchemxFormApi<{ name: string }>
            ) => {
              formApi = nextFormApi
            },
          },
        },
      ],
      onReset,
    })

    await form.waitForDependencies()

    expect(formApi).toBeDefined()
    form.setFieldValue("name", "Grace")
    formApi?.reset()

    expect(form.getFieldValue("name")).toBe("Ada")
    expect(onReset).toHaveBeenCalledTimes(1)

    form.destroy()
  })

  it("Form 与 formApi 提供 Store 和 Validator 的单字段与多字段操作", async () => {
    let formApi: SchemxFormApi<{ name: string; age: number }> | undefined

    const form = createForm<{ name: string; age: number }>({
      initialValues: { name: "Ada", age: 20 },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          dependencies: {
            triggerFields: ["name"],
            trigger: (_values, nextFormApi) => {
              formApi = nextFormApi
            },
          },
        },
      ],
    })

    await form.waitForDependencies()

    expect(formApi).toBeDefined()

    form.setInitialValue("name", "初始姓名")
    form.setFieldValue("name", "修改后的姓名")
    form.resetField("name")
    expect(form.getFieldValue("name")).toBe("初始姓名")

    form.setFieldsValue({ name: "Ada", age: 21 })
    form.setFieldsTouched(["name", "age"])
    expect(form.isFieldsTouched(["name", "age"])).toBe(true)

    form.setFieldsPending(["name", "age"], true)
    expect(form.isFieldsPending(["name", "age"])).toBe(true)

    form.setFieldsErrors([
      { name: "name", errors: ["姓名错误"] },
      { name: "age", errors: ["年龄错误"] },
    ])
    expect(form.getFieldsErrors(["name", "age"])).toEqual([
      { name: "name", errors: ["姓名错误"] },
      { name: "age", errors: ["年龄错误"] },
    ])
    form.clearFieldsErrors(["name", "age"])

    form.setFieldsRules([
      {
        name: "name",
        rules: [{ validate: () => ({ valid: true }) }],
      },
    ])
    form.removeFieldsRules(["name"])

    if (!formApi) {
      throw new Error("formApi 未初始化")
    }

    const api = formApi

    api.setFieldsValue({ name: "Grace", age: 22 })
    expect(api.getFieldsValue(["name", "age"])).toEqual({ name: "Grace", age: 22 })
    api.setFieldsTouched(["name", "age"], true)
    expect(api.isFieldsTouched(["name", "age"])).toBe(true)
    api.setFieldsPending(["name", "age"], true)
    expect(api.isFieldsPending(["name", "age"])).toBe(true)
    api.setFieldsErrors([{ name: "name", errors: ["接口错误"] }])
    expect(api.getFieldsErrors(["name"])).toEqual([
      { name: "name", errors: ["接口错误"] },
    ])
    api.clearFieldsErrors(["name"])

    api.setFieldsRules([
      {
        name: "name",
        rules: [{ validate: () => ({ valid: true }) }],
      },
    ])
    api.removeFieldsRules(["name"])

    form.destroy()
  })
})

describe("Form submit loading", () => {
  it("覆盖异步 onFinish，并为并发 submit 只发布一次状态切换", async () => {
    const deferred = createDeferred()

    const onLoadingChange = vi.fn()

    const form = createForm({
      initialValues: { name: "Ada" },
      onFinish: () => deferred.promise,
      onLoadingChange,
    })

    expect(form.isLoading()).toBe(false)

    const firstSubmit = form.submit()

    const secondSubmit = form.submit()

    expect(firstSubmit).toBe(secondSubmit)
    expect(form.isLoading()).toBe(true)
    expect(onLoadingChange.mock.calls).toEqual([[true]])

    deferred.resolve()
    await firstSubmit

    expect(form.isLoading()).toBe(false)
    expect(onLoadingChange.mock.calls).toEqual([[true], [false]])

    form.destroy()
  })

  it("校验失败后仍恢复 loading", async () => {
    const onLoadingChange = vi.fn()

    const form = createForm({
      initialValues: { name: "" },
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
          required: true,
        },
      ],
      onLoadingChange,
    })

    const result = await form.submit()

    expect(result.valid).toBe(false)
    expect(form.isLoading()).toBe(false)
    expect(onLoadingChange.mock.calls).toEqual([[true], [false]])

    form.destroy()
  })

  it("通过 FormStateAdapter 发布提交 loading 快照", async () => {
    const deferred = createDeferred()

    const form = createForm({
      initialValues: { name: "Ada" },
      onFinish: () => deferred.promise,
    })

    const store = createFormStateAdapter(form)

    const listener = vi.fn()

    const unsubscribe = store.loading.subscribe(listener)

    const submit = form.submit()

    expect(store.loading.getSnapshot()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)

    deferred.resolve()
    await submit

    expect(store.loading.getSnapshot()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    store.dispose()
    form.destroy()
  })
})
