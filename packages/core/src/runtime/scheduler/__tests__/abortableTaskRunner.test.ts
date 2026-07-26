/**
 * createAbortableTaskRunner 单元测试
 *
 * 覆盖可中止任务运行器的基本执行、新旧任务 abort、scope dispose 后不提交结果、dispose 后不再执行等行为。
 *
 * @module core/runtime/scheduler/__tests__/abortableTaskRunner
 */
import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope } from "../../node/scope"
import { createAbortableTaskRunner } from "../abortableTaskRunner"
import { createScheduler } from "../scheduler"

// 验证 createAbortableTaskRunner 的任务执行、中止、scope 清理、dispose 等行为
describe("createAbortableTaskRunner", () => {
  it("run 应通过 scheduler 跟踪任务并提交成功结果", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()
    const onSuccess = vi.fn()

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => "result",
      onSuccess,
    })

    await runner.run()

    expect(onSuccess).toHaveBeenCalledWith("result")
    expect(await scheduler.whenIdle()).toBe(true)
  })

  it("run 应返回当前任务的执行结果", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => "result",
    })

    await expect(runner.run()).resolves.toBe("result")
  })

  it("run 应在任务执行前提交当前 AbortController", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()
    const onStart = vi.fn()
    let observedSignal: AbortSignal | undefined

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: (signal) => {
        observedSignal = signal
        return "result"
      },
      onStart,
    })

    await runner.run()

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart.mock.calls[0][0].signal).toBe(observedSignal)
  })

  it("新的 run 应 abort 旧 run，旧结果不应提交", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()
    const onSuccess = vi.fn()
    let resolveFirst!: (value: string) => void
    let runCount = 0

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => {
        runCount += 1

        if (runCount === 2) {
          return "second"
        }

        return new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
      },
      onSuccess,
    })

    const firstRun = runner.run()
    const secondRun = runner.run()

    resolveFirst("first")
    await Promise.all([firstRun, secondRun])
    await scheduler.whenIdle()

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith("second")
  })

  it("scope dispose 后不应提交成功或错误结果", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()
    const onSuccess = vi.fn()
    const onError = vi.fn()

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: async () => {
        scope.dispose()
        return "late"
      },
      onSuccess,
      onError,
    })

    await runner.run()
    await scheduler.whenIdle()

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it("只应提交最新任务的错误", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()
    const onError = vi.fn()
    let rejectFirst!: (cause: unknown) => void
    let runCount = 0

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => {
        runCount += 1

        if (runCount === 2) {
          throw "latest"
        }

        return new Promise<string>((_, reject) => {
          rejectFirst = reject
        })
      },
      onError,
    })

    const firstRun = runner.run()
    const secondRun = runner.run()

    rejectFirst(new Error("first"))
    await Promise.all([firstRun, secondRun])
    await scheduler.whenIdle()

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe("latest")
  })

  it("dispose 后 run 不再执行任务", async () => {
    const scope = createRuntimeScope()
    const scheduler = createScheduler()
    const run = vi.fn(() => "result")
    const onSuccess = vi.fn()

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run,
      onSuccess,
    })

    runner.dispose()
    await runner.run()

    expect(run).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
