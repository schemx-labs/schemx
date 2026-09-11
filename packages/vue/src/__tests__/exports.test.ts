import { describe, expect, test } from "vitest"

import * as vuePackage from "../index"

describe("@schemx/vue 根入口", () => {
  test("导出上下文、Vue Instance 与 ViewSchemas 桥接 API", () => {
    expect(vuePackage).toMatchObject({
      createFieldContext: expect.any(Function),
      createFormConfigContext: expect.any(Function),
      createFormContext: expect.any(Function),
      provideFormContext: expect.any(Function),
      useFormContextValue: expect.any(Function),
      useStableRef: expect.any(Function),
      useViewSchemas: expect.any(Function),
      presetRuleRegistry: expect.any(Object),
      createPresetRuleRegistry: expect.any(Function),
      PresetRuleRegistry: expect.any(Function),
      RendererRegistry: expect.any(Function),
      Field: expect.any(Object),
      Group: expect.any(Object),
      Col: expect.any(Object),
      Wrapper: expect.any(Object),
      registerCol: expect.any(Function),
      ConfigProvider: expect.any(Object),
    })

    expect("getCoreForm" in vuePackage).toBe(false)
    expect("Cell" in vuePackage).toBe(false)
    expect("useFieldArray" in vuePackage).toBe(false)
    expect("createFieldArrayHook" in vuePackage).toBe(false)
    expect(["validator", "Registry"].join("") in vuePackage).toBe(false)
    expect(["create", "Validators", "Registry"].join("") in vuePackage).toBe(false)
  })
})
