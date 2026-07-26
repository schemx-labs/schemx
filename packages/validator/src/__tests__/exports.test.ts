import { describe, expect, test } from "vitest"

import * as asyncValidatorEntry from "../async-validator"
import * as validatorPackage from "../index"
import * as presetEntry from "../preset"

describe("@schemx/validator 入口边界", () => {
  test("根入口不加载可选 peer，运行时 adapter 由各子路径提供", () => {
    expect(Object.keys(validatorPackage)).toEqual([])
    expect(asyncValidatorEntry).toMatchObject({
      createAsyncValidatorAdapter: expect.any(Function),
    })
    expect(presetEntry).toMatchObject({
      createValidationAdapterPreset: expect.any(Function),
    })
  })

  test("各入口可创建对应 adapter 或预设", () => {
    expect(presetEntry.createValidationAdapterPreset()).toMatchObject({
      validatorAdapters: [expect.any(Object)],
    })
  })
})
