import { describe, expect, test } from "vitest"

import * as validatorPackage from "../index"

describe("@schemx/validator 入口边界", () => {
  test("根入口只提供 async-validator adapter 工厂", () => {
    expect(Object.keys(validatorPackage)).toEqual(["createAsyncValidatorAdapter"])
    expect(validatorPackage.createAsyncValidatorAdapter).toEqual(expect.any(Function))
  })

  test("工厂创建可直接注册的 async-validator adapter", () => {
    expect(validatorPackage.createAsyncValidatorAdapter()).toMatchObject({
      id: "async-validator",
      isRule: expect.any(Function),
      resolve: expect.any(Function),
    })
  })
})
