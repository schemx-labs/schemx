/**
 * Scope（RuntimeDispose）资源生命周期管理测试。
 *
 * 覆盖 scope 的创建、子 scope 释放顺序、cleanup 重复注册、提前注销
 * 以及 disposed 后注册立即执行等行为。
 *
 * @module core/runtime/node/__tests__/scope.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeDispose, createScope } from "../scope"

// Scope 资源生命周期：子 scope 释放顺序、cleanup 注册与提前注销、disposed 后注册
describe("Scope", () => {
  it("createRuntimeDispose 创建 RuntimeDispose 生命周期边界", () => {
    const dispose = createRuntimeDispose()
    const childDispose = dispose.child()
    const calls: string[] = []

    dispose.add(() => calls.push("parent"))
    childDispose.add(() => calls.push("child"))

    dispose.dispose()

    expect(calls).toEqual(["child", "parent"])
    expect(dispose.disposed).toBe(true)
    expect(childDispose.disposed).toBe(true)
  })

  it("add 返回的 handle 可以提前执行并避免 scope 重复清理", () => {
    const scope = createScope()
    const cleanup = vi.fn()

    const handle = scope.add(cleanup)

    expect(handle.disposed).toBe(false)

    handle.dispose()
    scope.dispose()

    expect(handle.disposed).toBe(true)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("dispose 时先释放子 scope，再按逆序执行当前 scope cleanup", () => {
    const scope = createScope()
    const childScope = scope.child()
    const calls: string[] = []

    scope.add(() => calls.push("parent:first"))
    scope.add(() => calls.push("parent:second"))
    childScope.add(() => calls.push("child"))

    scope.dispose()

    expect(calls).toEqual(["child", "parent:second", "parent:first"])
    expect(scope.disposed).toBe(true)
    expect(childScope.disposed).toBe(true)
  })

  it("disposed 后注册 cleanup 会立即执行并返回已释放 handle", () => {
    const scope = createScope()
    const cleanup = vi.fn()

    scope.dispose()
    const handle = scope.add(cleanup)

    expect(handle.disposed).toBe(true)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("同一个 cleanup 函数重复注册时应按注册次数执行", () => {
    const scope = createScope()
    const cleanup = vi.fn()

    scope.add(cleanup)
    scope.add(cleanup)
    scope.dispose()

    expect(cleanup).toHaveBeenCalledTimes(2)
  })
})
