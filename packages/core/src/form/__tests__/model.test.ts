import { describe, expect, it } from "vitest"

import { createValidationRuleRegistry } from "../../registry"
import { createFormModel } from "../model"

describe("FormModel", () => {
  it("不依赖 SchemaRuntime 即可管理值、重置和校验错误", () => {
    const model = createFormModel({
      initialValues: { name: "Alice" },
      validationRuleRegistry: createValidationRuleRegistry(),
      validatorAdapters: [],
    })

    model.store.setFieldValue("name", "Bob")
    model.validator.setFieldErrors("name", ["invalid"])

    expect(model.store.getFieldValue("name")).toBe("Bob")
    expect(model.validator.getFieldErrors("name")).toEqual(["invalid"])

    model.reset()

    expect(model.store.getFieldValue("name")).toBe("Alice")
    expect(model.validator.getFieldErrors("name")).toEqual([])

    model.dispose()
  })

  it("dispose 会停止由 Model 创建的 effect", () => {
    const model = createFormModel({
      initialValues: { name: "Alice" },
      validationRuleRegistry: createValidationRuleRegistry(),
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
