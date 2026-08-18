import { describe, expect, test } from "vitest"

import * as vuePackage from "../index"

describe("@schemx/vue 根入口", () => {
  test("导出上下文、Vue Instance 与 ViewSchemas 桥接 API", () => {
    expect(vuePackage).toMatchObject({
      createFieldContext: expect.any(Function),
      createFieldArrayHook: expect.any(Function),
      createFormConfigContext: expect.any(Function),
      createFormContext: expect.any(Function),
      useStableRef: expect.any(Function),
      useViewSchemas: expect.any(Function),
      validationRuleRegistry: expect.any(Object),
      createValidationRuleRegistry: expect.any(Function),
      ValidationRuleRegistry: expect.any(Function),
      RendererRegistry: expect.any(Function),
      Field: expect.any(Object),
      Group: expect.any(Object),
    })

    expect("getCoreForm" in vuePackage).toBe(false)
    expect(["validator", "Registry"].join("") in vuePackage).toBe(false)
    expect(["create", "Validators", "Registry"].join("") in vuePackage).toBe(false)
  })
})
