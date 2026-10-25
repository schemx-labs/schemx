// 会话状态、清理快照与延迟释放，不依赖 UI 重绘或系统信号。
import { describe, expect, it, vi } from "vite-plus/test"

import { createSession } from "../session.ts"

// 所有清理场景使用同一信号载荷，不实际向测试宿主发送信号。
const event = { signal: "SIGINT", exitCode: 130 } as const

describe("实例会话", () => {
  it("取消立即中止自有操作，保留清理输出并阻止新执行", () => {
    // 初始状态可执行且没有宿主退出屏障。
    const session = createSession()

    expect(session.getCancelled()).toBe(false)
    expect(session.isDisposed()).toBe(false)
    expect(session.getSignalExit()).toBeUndefined()
    session.checkExecution()
    session.beginSignal()
    expect(session.getCancelled()).toBe(true)
    expect(session.signal.aborted).toBe(true)
    expect(session.isHandlingSignal()).toBe(true)
    expect(session.isFinalizing()).toBe(false)
    expect(session.getSignalExit()).toBeInstanceOf(Promise)
    expect(() => session.check()).not.toThrow()
    expect(() => session.checkExecution()).toThrow("操作已取消")
    session.beginFinalizing()
    expect(session.isFinalizing()).toBe(true)
  })

  it("异步清理使用注册快照，注销不跳过本轮回调，异常不打断后续清理", async () => {
    // 单个实例清理不依赖其他实例或进程级协调器。
    const session = createSession()

    // 顺序记录用于验证异步等待、注销及异常的相对位置。
    const order: string[] = []

    // 原始错误身份应交给消息模块，不被会话重新包装。
    const failure = new Error("清理失败")

    // 记录清理错误的次数和身份。
    const reportError = vi.fn()

    // 显式控制异步清理，不依赖定时器或抢占时序。
    let resume: (() => void) | undefined

    // Promise 构造时同步保存结算操作，稍后在测试中释放。
    const gate = new Promise<void>(
      /**
       * 保存清理等待的解除操作。
       * @param resolve - 允许第一个异步监听继续执行。
       */
      (resolve) => {
        resume = resolve
      }
    )

    session.onSignal({
      listener: async () => {
        order.push("first:start")
        await gate
        unsubscribeSecond()
        order.push("first:end")
      },
    })
    // 本轮开始后即使注销，也必须按照已经取得的快照执行一次。
    const unsubscribeSecond = session.onSignal({
      listener: () => {
        order.push("second")
        throw failure
      },
    })

    session.onSignal({
      listener: () => {
        order.push("last")
      },
    })
    session.beginSignal()
    // 开始清理后保留 Promise，验证门闩释放前不会提前完成。
    const cleaning = session.cleanSignal({ event, reportError })

    expect(order).toEqual(["first:start"])
    expect(reportError).not.toHaveBeenCalled()
    if (!resume) {
      throw new Error("异步清理门闩未初始化。")
    }

    resume()
    await cleaning
    expect(order).toEqual(["first:start", "first:end", "second", "last"])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure)
    unsubscribeSecond()
  })

  it("清理中的释放请求推迟到范围收尾之后，且仅释放一次", async () => {
    // 延迟释放允许后续外部清理继续使用消息能力。
    const session = createSession()

    // 模拟系统监听注销，必须在实际资源释放前发生。
    const unsubscribe = vi.fn()

    // 模拟各模块自有资源的聚合释放。
    const release = vi.fn()

    // 后续监听检查实例仍可输出。
    const lastCleanup = vi.fn(() => session.check())

    session.onSignal({ listener: () => session.dispose({ unsubscribe, release }) })
    session.onSignal({ listener: lastCleanup })
    session.beginSignal()
    await session.cleanSignal({ event, reportError: vi.fn() })
    expect(lastCleanup).toHaveBeenCalledOnce()
    expect(session.isDisposed()).toBe(false)
    expect(release).not.toHaveBeenCalled()
    session.beginFinalizing()
    session.finishDisposal()
    session.finishDisposal()
    session.dispose({ unsubscribe, release })
    expect(session.isDisposed()).toBe(true)
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
    expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      release.mock.invocationCallOrder[0] ?? 0
    )
    expect(() => session.check()).toThrow("已释放")
  })

  it("普通释放同步注销监听并中止操作，重复释放及注销保持幂等", async () => {
    // 未进入信号清理时，释放无需等待进程退出阶段。
    const session = createSession()

    // 确认注销后的外部监听不会参与清理。
    const listener = vi.fn()

    // 公开取消订阅只影响该监听，不释放实例。
    const remove = session.onSignal({ listener })

    remove()
    remove()
    await session.cleanSignal({ event, reportError: vi.fn() })
    expect(listener).not.toHaveBeenCalled()
    // 区分注销、abort 和资源释放的顺序。
    const order: string[] = []

    session.signal.addEventListener("abort", () => {
      order.push("abort")
    })
    // 回调在中止前运行，保证输入不会在释放期间继续进入。
    const unsubscribe = (): void => {
      order.push("unsubscribe")
    }

    // 中止后再释放模块自己的流和状态。
    const release = (): void => {
      order.push("release")
    }

    session.dispose({ unsubscribe, release })
    session.dispose({ unsubscribe, release })
    expect(order).toEqual(["unsubscribe", "abort", "release"])
    expect(session.signal.aborted).toBe(true)
    expect(session.getCancelled()).toBe(false)
    expect(() => session.checkExecution()).toThrow("已释放")
  })
})
