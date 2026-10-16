import { describe, expect, test } from "vite-plus/test"

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
      Field: expect.any(Object),
      Group: expect.any(Object),
      Col: expect.any(Object),
      Row: expect.any(Object),
      Icon: expect.any(Object),
      Wrapper: expect.any(Object),
      ConfigProvider: expect.any(Object),
      createFormComponent: expect.any(Function),
      provideSchemxAppConfig: expect.any(Function),
      createFormStateAdapter: expect.any(Function),
      createFormWithConfig: expect.any(Function),
      getFormCreationConfig: expect.any(Function),
    })

    expect("provideSchemxFormRuntime" in vuePackage).toBe(false)
    expect(vuePackage.createSchemx).toEqual(expect.any(Function))
    expect("createFieldHook" in vuePackage).toBe(false)
    expect("useViewSchema" in vuePackage).toBe(false)
    expect("getGroupScrollPathKey" in vuePackage).toBe(false)
    expect("normalizeCreateSchemxOptions" in vuePackage).toBe(false)
    expect(Object.isFrozen(vuePackage.defaultConfig)).toBe(true)
    expect(vuePackage.defaultConfig).not.toHaveProperty("rendererRegistry")
    expect("getCoreForm" in vuePackage).toBe(false)
    expect("Cell" in vuePackage).toBe(false)
    expect("useFieldArray" in vuePackage).toBe(false)
    expect("createFieldArrayHook" in vuePackage).toBe(false)
    expect("PresetRuleRegistry" in vuePackage).toBe(false)
    expect("RendererRegistry" in vuePackage).toBe(false)
    expect(["validator", "Registry"].join("") in vuePackage).toBe(false)
    expect(["create", "Validators", "Registry"].join("") in vuePackage).toBe(false)
  })
})
