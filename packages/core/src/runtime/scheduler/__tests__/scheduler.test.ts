/**
 * Scheduler 模块测试。
 *
 * @module core/runtime/scheduler/__tests__/scheduler.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope } from "../../node/scope"
import { createScheduler } from "../scheduler"

// 验证 schedule 按 normal/post 队列顺序执行任务
describe("schedule", () => {
  it("同一 tick 内只安排一次 flush microtask", async () => {
    const scheduler = createScheduler()

    const queueMicrotask = vi.spyOn(globalThis, "queueMicrotask")

    for (let index = 0; index < 1000; index++) {
      scheduler.schedule({
        id: `task-${index}`,
        priority: "normal",
        run: () => {},
      })
    }

    expect(queueMicrotask).toHaveBeenCalledTimes(1)

    await scheduler.flush()

    queueMicrotask.mockRestore()
  })

  it("应该按 normal/post 顺序调度任务", async () => {
    const scheduler = createScheduler()

    const order: string[] = []

    scheduler.schedule({
      id: "post-1",
      priority: "post",
      run: () => {
        order.push("post")
      },
    })

    scheduler.schedule({
      id: "normal-1",
      priority: "normal",
      run: () => {
        order.push("normal")
      },
    })

    await scheduler.flush()

    expect(order).toEqual(["normal", "post"])
  })

  it("应该在 normal/post 完成后执行 idle 任务", async () => {
    const scheduler = createScheduler()

    const order: string[] = []

    scheduler.schedule({
      id: "idle-1",
      priority: "idle",
      run: () => {
        order.push("idle")
      },
    })

    scheduler.schedule({
      id: "normal-1",
      priority: "normal",
      run: () => {
        order.push("normal")
      },
    })

    await scheduler.flush()

    expect(order).toEqual(["normal", "idle"])
  })

  it("应该在浏览器空闲回调中自动执行 idle 任务", async () => {
    const requestIdleCallback = vi.fn()

    vi.stubGlobal("requestIdleCallback", requestIdleCallback)

    const scheduler = createScheduler()

    const task = vi.fn()

    scheduler.schedule({
      id: "idle-1",
      priority: "idle",
      run: task,
    })

    expect(requestIdleCallback).toHaveBeenCalledTimes(1)
    expect(task).not.toHaveBeenCalled()

    const callback = requestIdleCallback.mock.calls[0]?.[0] as
      | ((deadline: { didTimeout: boolean; timeRemaining(): number }) => void)
      | undefined

    callback?.({
      didTimeout: false,
      timeRemaining: () => 5,
    })

    await scheduler.whenIdle()

    expect(task).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it("相同队列与任务 ID 只执行最后一次任务", async () => {
    const scheduler = createScheduler()

    const order: string[] = []

    scheduler.schedule({
      id: "same",
      priority: "normal",
      run: () => {
        order.push("first")
      },
    })

    scheduler.schedule({
      id: "same",
      priority: "normal",
      run: () => {
        order.push("last")
      },
    })

    await scheduler.flush()

    expect(order).toEqual(["last"])
  })
})

// 验证 flush 等待同步/异步任务完成、flush 期间新调度任务继续执行
describe("flush", () => {
  it("应该等待所有同步任务完成", async () => {
    const scheduler = createScheduler()

    let executed = false

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: () => {
        executed = true
      },
    })

    expect(executed).toBe(false)

    await scheduler.flush()

    expect(executed).toBe(true)
  })

  it("应该等待所有异步任务完成", async () => {
    const scheduler = createScheduler()

    let executed = false

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        executed = true
      },
    })

    expect(executed).toBe(false)

    await scheduler.flush()

    expect(executed).toBe(true)
  })

  it("应该继续执行 flush 期间新调度的任务", async () => {
    const scheduler = createScheduler()

    const order: string[] = []

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: () => {
        order.push("task-1")
        scheduler.schedule({
          id: "task-2",
          priority: "post",
          run: () => {
            order.push("task-2")
          },
        })
      },
    })

    const result = await scheduler.whenIdle(50)

    expect(result).toBe(true)
    expect(order).toEqual(["task-1", "task-2"])
  })

  it("达到时间片预算后应该让出当前 microtask", async () => {
    const scheduler = createScheduler({ timeSliceMs: 0 })

    const order: string[] = []

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: () => {
        order.push("task-1")
      },
    })

    scheduler.schedule({
      id: "task-2",
      priority: "normal",
      run: () => {
        order.push("task-2")
      },
    })

    queueMicrotask(() => {
      order.push("microtask")
    })

    await scheduler.flush()

    expect(order).toEqual(["task-1", "microtask", "task-2"])
  })

  it("debug Scheduler 应记录让出次数与任务耗时", async () => {
    const scheduler = createScheduler({ timeSliceMs: 0, collectDiagnostics: true })

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: () => {},
    })

    scheduler.schedule({
      id: "task-2",
      priority: "normal",
      run: () => {},
    })

    await scheduler.flush()

    const diagnostics = scheduler.getDiagnostics()

    expect(diagnostics.yieldedCount).toBe(1)
    expect(diagnostics.maxTaskDurationMs).toBeGreaterThanOrEqual(0)
    expect(diagnostics.queued).toEqual({ normal: 0, post: 0, idle: 0 })
  })
})

// 验证 whenIdle 在空闲时立即返回 true、有任务时等待完成、超时返回 false
describe("whenIdle", () => {
  it("应该在空闲队列时立即返回 true", async () => {
    const scheduler = createScheduler()

    const result = await scheduler.whenIdle()

    expect(result).toBe(true)
  })

  it("应该在有任务时等待完成", async () => {
    const scheduler = createScheduler()

    let executed = false

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        executed = true
      },
    })

    const result = await scheduler.whenIdle(1000)

    expect(result).toBe(true)
    expect(executed).toBe(true)
  })

  it("应该在超时时返回 false", async () => {
    const scheduler = createScheduler()

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: async () => {
        // 永不完成的任务
        await new Promise(() => {})
      },
    })

    const result = await scheduler.whenIdle(50)

    expect(result).toBe(false)
  })

  it("关键空闲判断不应等待 idle 队列", async () => {
    const scheduler = createScheduler()

    const task = vi.fn()

    scheduler.schedule({
      id: "idle-1",
      priority: "idle",
      run: task,
    })

    await expect(scheduler.whenIdle({ includeIdle: false })).resolves.toBe(true)
    expect(task).not.toHaveBeenCalled()

    scheduler.dispose()
  })

  it("关键空闲判断应等待 normal 任务及其异步工作", async () => {
    const scheduler = createScheduler()

    let resolveTask: (() => void) | undefined

    scheduler.schedule({
      id: "normal-1",
      priority: "normal",
      run: () =>
        new Promise<void>((resolve) => {
          resolveTask = resolve
        }),
    })

    const idlePromise = scheduler.whenIdle({ includeIdle: false, timeout: 1000 })

    await Promise.resolve()
    expect(resolveTask).toBeDefined()

    resolveTask?.()

    await expect(idlePromise).resolves.toBe(true)
  })

  it("dispose 会结束等待中的 idle waiter", async () => {
    const scheduler = createScheduler()

    void scheduler.track(new Promise<void>(() => {}))

    const idleResult = scheduler.whenIdle()

    scheduler.dispose()

    await expect(idleResult).resolves.toBe(false)
  })
})

// 验证 track 追踪外部 Promise，whenIdle 等待其完成，支持链式调用
describe("track", () => {
  it("应该在 track 后 whenIdle 等待该任务", async () => {
    const scheduler = createScheduler()

    let executed = false

    const promise = new Promise<void>((resolve) => {
      setTimeout(() => {
        executed = true
        resolve()
      }, 10)
    })

    scheduler.track(promise)

    const result = await scheduler.whenIdle(1000)

    expect(result).toBe(true)
    expect(executed).toBe(true)
  })

  it("应该支持链式调用", async () => {
    const scheduler = createScheduler()

    const result = await scheduler.track(Promise.resolve(42))

    expect(result).toBe(42)
  })
})

// 验证 scope disposed 后不执行关联的同步/异步任务
describe("scope cancellation", () => {
  it("应该在 scope disposed 后不执行关联任务", async () => {
    const scheduler = createScheduler()

    const scope = createRuntimeScope()

    const task = vi.fn()

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      scope,
      run: task,
    })

    // 在 flush 前释放 scope
    scope.dispose()

    await scheduler.flush()

    expect(task).not.toHaveBeenCalled()
  })

  it("任务已开始后由任务自身负责响应 scope dispose", async () => {
    const scheduler = createScheduler()

    const scope = createRuntimeScope()

    const task = vi.fn()

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      scope,
      run: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        task()
      },
    })

    // 在任务执行期间释放 scope
    setTimeout(() => scope.dispose(), 5)

    await scheduler.flush()

    expect(task).toHaveBeenCalledTimes(1)
  })
})

// 验证任务抛错后其他任务继续执行，onError 回调被调用
describe("error handling", () => {
  it("应该在任务抛错后继续执行其他任务", async () => {
    const scheduler = createScheduler()

    const order: string[] = []

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: () => {
        order.push("task-1")
        throw new Error("task-1 error")
      },
      onError: vi.fn(),
    })

    scheduler.schedule({
      id: "task-2",
      priority: "normal",
      run: () => {
        order.push("task-2")
      },
    })

    await scheduler.flush()

    expect(order).toEqual(["task-1", "task-2"])
  })

  it("应该调用 onError 回调", async () => {
    const scheduler = createScheduler()

    const error = new Error("test error")

    const onError = vi.fn()

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: () => {
        throw error
      },
      onError,
    })

    await scheduler.flush()

    expect(onError).toHaveBeenCalledWith(error)
  })
})

// 验证 dispose 后不再执行新调度任务
describe("dispose", () => {
  it("应该在 dispose 后不再执行任务", async () => {
    const scheduler = createScheduler()

    scheduler.dispose()

    const task = vi.fn()

    scheduler.schedule({
      id: "task-1",
      priority: "normal",
      run: task,
    })

    await scheduler.flush()

    expect(task).not.toHaveBeenCalled()
  })
})
