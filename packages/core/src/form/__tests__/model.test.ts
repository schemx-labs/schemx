import { describe, expect, it } from "vite-plus/test"

import { createFormConfig, createFormModel } from ".."

describe("FormModel", () => {
  it("Model 不拥有配置生命周期，配置销毁后停止订阅和提交", () => {
    const configuration = createFormConfig<{ name: string }>()

    const published: (boolean | undefined)[] = []

    configuration.state.subscribe((config) =>
      published.push(config.schemaConfig.disabled)
    )
    const model = createFormModel({
      configuration,
      initialValues: { name: "Alice" },
    })

    expect(model.state.config).toBe(configuration.state)
    expect(model.getConfig()).toBe(configuration.getConfig())
    model.dispose()
    configuration.setConfig({ schemaConfig: { disabled: true } })
    expect(published).toEqual([false, true])
    configuration.dispose()
    configuration.setConfig({ schemaConfig: { disabled: false } })
    expect(configuration.getConfig().schemaConfig.disabled).toBe(true)
    expect(published).toEqual([false, true])
  })

  it("不依赖 SchemaRuntime 即可管理值、重置和校验错误", () => {
    const configuration = createFormConfig<{ name: string }>()

    const model = createFormModel({
      configuration,
      initialValues: { name: "Alice" },
    })

    model.store.setFieldValue("name", "Bob")
    model.store.setFieldErrors("name", [{ type: "external", message: "invalid" }])

    expect(model.store.getFieldValue("name")).toBe("Bob")
    expect(model.store.getFieldErrors("name")).toEqual([
      { type: "external", message: "invalid" },
    ])

    model.reset()

    expect(model.store.getFieldValue("name")).toBe("Alice")
    expect(model.store.getFieldErrors("name")).toEqual([])

    model.dispose()
    configuration.dispose()
  })

  it("dispose 会停止由 Model 创建的 effect", () => {
    const configuration = createFormConfig<{ name: string }>()

    const model = createFormModel({
      configuration,
      initialValues: { name: "Alice" },
    })

    let runs = 0

    model.effect(() => {
      model.store.getFieldValue("name")
      runs++
    })

    expect(runs).toBe(1)

    model.dispose()
    configuration.dispose()
    model.store.setFieldValue("name", "Bob")

    expect(runs).toBe(1)
  })
})
