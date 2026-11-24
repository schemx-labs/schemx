/**
 * Form 重置回调与提交 loading 测试。
 *
 * @module core/__tests__/formCallbacks
 */

import { describe, expect, it, vi } from "vite-plus/test"

import { createForm } from "../createForm"
import { createFormStateAdapter } from "../index"

import type { SchemxFormApi, SchemxInstance } from "../types"

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

describe("Form 字段路径变化回调", () => {
  it("精确报告变化叶子并保留值回调的顶层片段", () => {
    // 同时观察字段路径和按顶层聚合的值差异。
    const onFieldsChange = vi.fn()

    const onValuesChange = vi.fn()

    // 使用两个兄弟字段，验证未修改路径不会进入结果。
    const form = createForm({
      initialValues: { user: { name: "Ada", age: 20 } },
      onFieldsChange,
      onValuesChange,
    })

    try {
      form.setFieldValue("user.name", "Grace")
      expect(onFieldsChange).toHaveBeenLastCalledWith(
        ["user.name"],
        ["user.name", "user.age"]
      )
      expect(onValuesChange).toHaveBeenLastCalledWith(
        { user: { name: "Grace", age: 20 } },
        { user: { name: "Grace", age: 20 } }
      )

      form.batch(() => {
        form.setFieldValue("user.name", "Ada")
        form.setFieldValue("user.age", 21)
        form.setFieldValue("user.age", 22)
      })
      expect(onFieldsChange).toHaveBeenCalledTimes(2)
      expect(onFieldsChange).toHaveBeenLastCalledWith(
        ["user.name", "user.age"],
        ["user.name", "user.age"]
      )
      form.setFieldValue("user.age", 22)
      expect(onFieldsChange).toHaveBeenCalledTimes(2)
    } finally {
      form.destroy()
    }
  })

  it("报告删除的叶子和新增的 undefined 属性", () => {
    // 同时包含数组索引和可选对象属性的表单。
    const onFieldsChange = vi.fn()

    const form = createForm<{
      items: { name: string }[]
      user: { name?: string; age?: number }
    }>({
      initialValues: { items: [{ name: "Ada" }], user: { name: "Ada" } },
      onFieldsChange,
    })

    try {
      form.setFieldValue("user", { age: undefined })
      expect(onFieldsChange).toHaveBeenLastCalledWith(
        ["user.age", "user.name"],
        ["items[0].name", "user.age"]
      )
      form.setFieldValue("items", [])
      expect(onFieldsChange).toHaveBeenLastCalledWith(
        ["items", "items[0].name"],
        ["items", "user.age"]
      )
    } finally {
      form.destroy()
    }
  })
})

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
    expect(formApi?.getFieldValue("name")).toBe("Ada")
    expect(formApi).not.toHaveProperty("submit")
    expect(formApi).not.toHaveProperty("createField")
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
  it("loading 回调抛错后可以再次提交", async () => {
    // 首次启动抛错，第二次需要获得新的提交锁。
    const failure = new Error("loading callback failed")

    const onLoadingChange = vi.fn().mockImplementationOnce(() => {
      throw failure
    })

    const form = createForm({ initialValues: { name: "Ada" }, onLoadingChange })

    try {
      await expect(form.submit()).rejects.toBe(failure)
      expect(form.isLoading()).toBe(false)
      await expect(form.submit()).resolves.toMatchObject({ valid: true })
      expect(onLoadingChange.mock.calls).toEqual([[true], [false], [true], [false]])
    } finally {
      form.destroy()
    }
  })

  it("loading 回调同步再次提交时复用同一 Promise", async () => {
    // 记录重入调用的结果以及提交完成通知。
    let reentered: ReturnType<SchemxInstance<{ name: string }>["submit"]> | undefined

    let entering = false

    const onFinish = vi.fn()

    // loading 为提交状态，仅在首次开启时尝试重入。
    const onLoadingChange = vi.fn((loading: boolean) => {
      if (loading && !entering) {
        entering = true
        reentered = form.submit()
      }
    })

    // 启动时会同步派发 loading 回调的表单。
    const form = createForm({ initialValues: { name: "Ada" }, onLoadingChange, onFinish })

    try {
      const submitted = form.submit()

      expect(reentered).toBe(submitted)
      expect(form.isLoading()).toBe(true)
      expect(await submitted).toMatchObject({ valid: true })
      expect(onLoadingChange.mock.calls).toEqual([[true], [false]])
      expect(onFinish).toHaveBeenCalledTimes(1)
    } finally {
      form.destroy()
    }
  })

  it("依赖内校验立即结束，外部提交等待动态字段挂载", async () => {
    // 控制 renderer 是否继续提交子树。
    const gate = createDeferred()

    // renderer 完成本轮内部校验时通知测试。
    const checked = createDeferred()

    // 保存本轮回调 API，验证任务结束后可重新校验。
    let savedApi: SchemxFormApi<{ name: string; derived?: string }> | undefined

    // 记录 renderer 内两种校验以及在依赖结束前送达的外部提交结果。
    const internal = vi.fn()

    const finished = vi.fn()

    // 保留待挂载字段的类型，使内外校验使用同一份表单值契约。
    const form = createForm<{ name: string; derived?: string }>({
      initialValues: { name: "Ada" },
      schemas: [
        {
          to: ["name"],
          // values 为当前快照，api 绑定本轮 renderer。
          renderer: async (_values, api) => {
            savedApi = api
            const field = api.validateField("name")

            await Promise.resolve()
            internal(await field, await api.validate())
            checked.resolve()
            await gate.promise

            return [
              {
                name: "derived",
                label: "派生字段",
                componentType: "input",
                required: true,
              },
            ]
          },
        },
      ],
    })

    try {
      const submitted = form.submit().then(finished)

      await checked.promise
      const expected = {
        valid: false,
        errors: [{ scope: "form", issues: [{ code: "dependency_validation_reentry" }] }],
      }

      expect(internal).toHaveBeenCalledTimes(1)
      expect(internal.mock.calls[0]?.[0]).toMatchObject(expected)
      expect(internal.mock.calls[0]?.[1]).toMatchObject(expected)
      expect(finished).not.toHaveBeenCalled()
      expect(form.getFieldErrors("name")).toEqual([])

      gate.resolve()
      await submitted
      expect(finished.mock.calls[0]?.[0]).toMatchObject({
        valid: false,
        errors: [{ scope: "field", name: "derived" }],
      })
      expect(await savedApi?.validateField("name")).toMatchObject({ valid: true })
    } finally {
      gate.resolve()
      form.destroy()
    }
  })

  it("已卸载的依赖任务校验返回取消结果", async () => {
    // 让 renderer 在卸载后继续调用其原先获取的 API。
    const gate = createDeferred()

    const checked = createDeferred()

    const results = vi.fn()

    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [
        {
          to: ["name"],
          // api 属于即将被卸载的依赖节点。
          renderer: async (_values, api) => {
            await gate.promise
            results(await api.validateField("name"))
            checked.resolve()

            return []
          },
        },
      ],
    })

    try {
      form.setSchemas([])
      gate.resolve()
      await checked.promise
      expect(results).toHaveBeenCalledWith({
        valid: false,
        cancelled: true,
        values: { name: "Ada" },
        errors: [],
      })
    } finally {
      gate.resolve()
      form.destroy()
    }
  })

  it("loading 回调同步重置时取消提交，不派发完成回调", async () => {
    // 取消结果不能误入成功或失败业务回调。
    const onFinish = vi.fn()

    // 重置取消与普通校验失败保持区分。
    const onFinishFailed = vi.fn()

    /**
     * 在提交启动时同步重置，检查入口是否提前捕获重置版本。
     * @param loading - 当前提交状态；仅启动时触发重置。
     */
    const onLoadingChange = vi.fn((loading: boolean): void => {
      if (loading) form.reset()
    })

    // 不配置异步规则，使取消仅来源于 loading 回调内的重置。
    const form = createForm({
      initialValues: { name: "Ada" },
      onFinish,
      onFinishFailed,
      onLoadingChange,
    })

    // submit 必须返回取消结果，并正常关闭 loading。
    const result = await form.submit()

    expect(result).toMatchObject({ valid: false, cancelled: true })
    expect(onFinish).not.toHaveBeenCalled()
    expect(onFinishFailed).not.toHaveBeenCalled()
    expect(form.isLoading()).toBe(false)
    expect(onLoadingChange.mock.calls).toEqual([[true], [false]])

    form.destroy()
  })

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
