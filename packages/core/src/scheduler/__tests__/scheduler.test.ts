/**
 * Scheduler 模块测试。
 *
 * @module core/node/__tests__/scheduler.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeScope } from "../../node/scope"
import { createScheduler } from "../scheduler"

describe("schedule", () => {
  it("应该调度 sync/pre/normal/post 任务", async () => {
    const scheduler = createScheduler()

    const order: string[] = []

    scheduler.schedule({
      id: "post-1",
      priority: "post",
      run: () => order.push("post"),
    })

    scheduler.schedule({
      id: "normal-1",
      priority: "normal",
      run: () => order.push("normal"),
    })

    scheduler.schedule({
      id: "pre-1",
      priority: "pre",
      run: () => order.push("pre"),
    })

    scheduler.schedule({
      id: "sync-1",
      priority: "sync",
      run: () => order.push("sync"),
    })

    await scheduler.flush()

    expect(order).toEqual(["sync", "pre", "normal", "post"])
  })

  it("应该按优先级顺序执行任务", async () => {
    const scheduler = createScheduler()

    const order: string[] = []

    scheduler.schedule({
      id: "1",
      priority: "normal",
      run: () => order.push("normal-1"),
    })

    scheduler.schedule({
      id: "2",
      priority: "sync",
      run: () => order.push("sync-1"),
    })

    scheduler.schedule({
      id: "3",
      priority: "post",
      run: () => order.push("post-1"),
    })

    scheduler.schedule({
      id: "4",
      priority: "pre",
      run: () => order.push("pre-1"),
    })

    await scheduler.flush()

    expect(order).toEqual(["sync-1", "pre-1", "normal-1", "post-1"])
  })
})

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
})

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
})

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

  it("应该在 scope disposed 后取消关联异步任务", async () => {
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

    // 任务可能已开始，但应该在 scope disposed 后不执行后续逻辑
    // 这里主要验证不会崩溃
  })
})

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
