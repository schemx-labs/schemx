import { describe, expect, it } from "vitest"

import { createPresetRuleRegistry } from "../../registry"
import { createFormModel } from "../model"

describe("FormModel", () => {
  it("不依赖 SchemaRuntime 即可管理值、重置和校验错误", () => {
    const model = createFormModel({
      initialValues: { name: "Alice" },
      presetRuleRegistry: createPresetRuleRegistry(),
      validatorAdapters: [],
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
  })

  it("dispose 会停止由 Model 创建的 effect", () => {
    const model = createFormModel({
      initialValues: { name: "Alice" },
      presetRuleRegistry: createPresetRuleRegistry(),
      validatorAdapters: [],
    })

    let runs = 0

    model.effect(() => {
      model.store.getFieldValue("name")
      runs++
    })

    expect(runs).toBe(1)

    model.dispose()
    model.store.setFieldValue("name", "Bob")

    expect(runs).toBe(1)
  })
})
