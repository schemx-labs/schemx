import { describe, expect, test } from "vitest"

import * as vuePackage from "../index"

describe("@schemx/vue 根入口", () => {
  test("导出上下文、Vue Facade 与 ViewSchemas 桥接 API", () => {
    expect(vuePackage).toMatchObject({
      createFieldContext: expect.any(Function),
      createFormConfigContext: expect.any(Function),
      createFormContext: expect.any(Function),
      getCoreForm: expect.any(Function),
      useStableRef: expect.any(Function),
      useViewSchemas: expect.any(Function),
      validationRuleRegistry: expect.any(Object),
      createValidationRuleRegistry: expect.any(Function),
      ValidationRuleRegistry: expect.any(Function),
      RendererRegistry: expect.any(Function),
    })

    expect(["validator", "Registry"].join("") in vuePackage).toBe(false)
    expect(["create", "Validators", "Registry"].join("") in vuePackage).toBe(false)
  })
})
