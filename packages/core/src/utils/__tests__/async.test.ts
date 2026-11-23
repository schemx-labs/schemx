/**
 * withLock 异步锁工具单元测试
 *
 * 覆盖首次调用执行、执行中复用 Promise、完成后重新执行、
 * 异常后释放锁、连续调用仅执行一次。
 *
 * @module utils/__tests__/async
 */
import { describe, expect, it, vi } from "vitest"

import { withLock } from "../async"

describe("withLock", () => {
  it("首次调用执行原始异步函数", async () => {
    const fn = vi.fn().mockResolvedValue("result")
    const locked = withLock(fn)

    const result = await locked()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(result).toBe("result")
  })

  it("执行中再次调用返回同一个 Promise", () => {
    let resolve: (v: string) => void
    const fn = vi.fn().mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolve = r
        })
    )
    const locked = withLock(fn)

    const p1 = locked()
    const p2 = locked()

    expect(p1).toBe(p2)
    expect(fn).toHaveBeenCalledTimes(1)

    resolve!("done")

    return p1
  })

  it("执行完成后再次调用重新执行", async () => {
    const fn = vi.fn().mockResolvedValue("ok")
    const locked = withLock(fn)

    await locked()
    await locked()

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("异常后释放锁，后续调用可正常执行", async () => {
    let callCount = 0
    const fn = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error("fail")

      return "success"
    })
    const locked = withLock(fn)

    await expect(locked()).rejects.toThrow("fail")

    const result = await locked()
    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("连续调用多次仅执行一次", async () => {
    const fn = vi.fn().mockResolvedValue("ok")
    const locked = withLock(fn)

    const promises = [locked(), locked(), locked()]
    await Promise.all(promises)

    expect(fn).toHaveBeenCalledTimes(1)
  })
})
