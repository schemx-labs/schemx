/**
 * createAbortableTaskRunner 单元测试
 *
 * 覆盖可中止任务运行器的基本执行、新旧任务 abort、scope dispose 后不提交结果、dispose 后不再执行等行为。
 *
 * @module core/scheduler/__tests__/abortableTaskRunner
 */
import { describe, expect, it, vi } from "vite-plus/test"

import { createAbortableTaskRunner, createScheduler } from ".."
import { createScope } from "../../node"

// 验证 createAbortableTaskRunner 的任务执行、中止、scope 清理、dispose 等行为
describe("createAbortableTaskRunner", () => {
  it("run 应通过 scheduler 跟踪任务并提交成功结果", async () => {
    const scope = createScope()

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
    const scope = createScope()

    const scheduler = createScheduler()

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => "result",
    })

    await expect(runner.run()).resolves.toBe("result")
  })

  it("run 应在任务执行前提交当前 AbortController", async () => {
    const scope = createScope()

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
    const scope = createScope()

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

  it("被替代但永不 settle 的旧任务不会阻塞 scheduler idle", async () => {
    const scope = createScope()

    const scheduler = createScheduler()

    let runCount = 0

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => {
        runCount += 1

        if (runCount === 1) {
          return new Promise<string>(() => {})
        }

        return "latest"
      },
    })

    void runner.run()
    await expect(runner.run()).resolves.toBe("latest")

    await expect(scheduler.whenIdle(20)).resolves.toBe(true)
  })

  it("scope dispose 后不应提交成功或错误结果", async () => {
    const scope = createScope()

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
    const scope = createScope()

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
    const scope = createScope()

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
  it("独立释放只取消当前 runner，父资源和其他任务继续工作", async () => {
    // 两个 runner 借用同一资源，只有第一个存在永不完成的请求。
    const scope = createScope()

    const scheduler = createScheduler()

    let signal: AbortSignal | undefined

    const first = createAbortableTaskRunner({
      scope,
      scheduler,
      run: (current) => {
        signal = current

        return new Promise<void>(() => {})
      },
    })

    const second = createAbortableTaskRunner({ scope, scheduler, run: () => "second" })

    void first.run()
    first.dispose()
    first.dispose()
    expect(signal?.aborted).toBe(true)
    expect(scope.disposed).toBe(false)
    await expect(second.run()).resolves.toBe("second")
    await expect(scheduler.whenIdle(20)).resolves.toBe(true)
    scope.dispose()
    await expect(second.run()).resolves.toBeUndefined()
  })

  it("onStart 同步释放父资源时不调用任务或提交回调", async () => {
    const scope = createScope()

    const scheduler = createScheduler()

    const run = vi.fn(() => "late")

    const onSuccess = vi.fn()

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run,
      onSuccess,
      onStart: () => scope.dispose(),
    })

    await expect(runner.run()).resolves.toBeUndefined()
    expect(run).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    await expect(scheduler.whenIdle(20)).resolves.toBe(true)
  })

  it("onStart 重入时只运行最新请求，旧登记不会覆盖新任务", async () => {
    const scope = createScope()

    const scheduler = createScheduler()

    const onSuccess = vi.fn()

    let restarted = false

    let latest: Promise<string | undefined> | undefined

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => "latest",
      onSuccess,
      onStart: () => {
        if (!restarted) {
          restarted = true
          latest = runner.run()
        }
      },
    })

    await expect(runner.run()).resolves.toBeUndefined()
    await expect(latest).resolves.toBe("latest")
    expect(onSuccess).toHaveBeenCalledTimes(1)
    await expect(scheduler.whenIdle(20)).resolves.toBe(true)
    scope.dispose()
  })
  it("替换任务不会让既有完成等待在新任务结束前提前兑现", async () => {
    // 第一轮永不完成，第二轮由用例控制完成时间。
    const scope = createScope()

    const scheduler = createScheduler()

    let count = 0

    let finish!: (value: string) => void

    const runner = createAbortableTaskRunner({
      scope,
      scheduler,
      run: () => {
        count += 1

        return count === 1
          ? new Promise<string>(() => {})
          : new Promise<string>((resolve) => {
              finish = resolve
            })
      },
    })

    void runner.run()
    // 等待在替换前已经登记，不能被旧任务的逻辑取消误唤醒。
    const settled = vi.fn()

    const waiting = scheduler.whenIdle(1000).then(settled)

    const latest = runner.run()

    await Promise.resolve()
    expect(settled).not.toHaveBeenCalled()
    finish("latest")
    await latest
    await waiting
    expect(settled).toHaveBeenCalledWith(true)
    scope.dispose()
  })
})
