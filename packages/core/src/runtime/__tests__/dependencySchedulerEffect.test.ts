/**
 * 依赖任务调度 effect 的测试。
 *
 * 覆盖精确字段订阅、首次执行策略、队列合并、非追踪任务和异步竞态。
 *
 * @module core/runtime/__tests__/dependencySchedulerEffect
 */

import { describe, expect, it, vi } from "vitest"

import { createStore } from "../../store"
import { createDepSchedulerEffect } from "../dependencySchedulerEffect"
import { createRuntimeScope } from "../node/scope"
import { createScheduler } from "../scheduler"

import type { SchemxFormApi } from "../../types"
import type { SchemaRuntimeContext } from "../context"

/**
 * 依赖任务调度测试使用的表单值。
 */
interface DependencySchedulerTestValues {
  /**
   * 触发依赖任务重新执行的国家字段。
   */
  country: string

  /**
   * 任务内部读取但不应被订阅的城市字段。
   */
  city: string
}

/**
 * 创建具有真实字段级 signal 的测试表单 API。
 *
 * @param store - 提供字段读取能力的测试 Store。
 * @returns 依赖调度测试所需的表单 API。
 */
function createTestFormApi(
  store: ReturnType<typeof createStore<DependencySchedulerTestValues>>
): SchemxFormApi<DependencySchedulerTestValues> {
  return {
    getValue: store.getFieldValue.bind(store),
    getValues: store.getFieldsValue.bind(store),
  } as unknown as SchemxFormApi<DependencySchedulerTestValues>
}

/**
 * 创建依赖任务测试所需的最小运行时上下文。
 *
 * @param formApi - 测试 Store 对应的表单读取接口。
 * @param scheduler - 跟踪和合并测试任务的 Scheduler。
 * @returns 可传入公共 effect 创建器的运行时上下文。
 */
function createTestContext(
  formApi: SchemxFormApi<DependencySchedulerTestValues>,
  scheduler: ReturnType<typeof createScheduler>
): SchemaRuntimeContext<DependencySchedulerTestValues> {
  return {
    formApi,
    scheduler,
  } as SchemaRuntimeContext<DependencySchedulerTestValues>
}

describe("createDepSchedulerEffect", () => {
  it("应只订阅 triggerFields，并在非追踪上下文执行任务", async () => {
    // 使用独立字段 signal 验证任务读取不会扩散订阅。
    const store = createStore<DependencySchedulerTestValues>({
      initialValues: { country: "CN", city: "Beijing" },
    })

    // 提供 effect 所需的表单读取接口与 Scheduler。
    const formApi = createTestFormApi(store)

    const scheduler = createScheduler()

    const context = createTestContext(formApi, scheduler)

    // 跟踪 effect 生命周期。
    const scope = createRuntimeScope()

    // 任务额外读取非触发字段，用于验证非追踪边界。
    const run = vi.fn(() => {
      void formApi.getValue("city")

      return "resolved"
    })

    createDepSchedulerEffect({
      context,
      triggerFields: ["country"],
      taskId: "test:dependency",
      scope,
      run,
    })
    await scheduler.whenIdle()

    expect(run).toHaveBeenCalledTimes(1)

    store.setFieldValue("city", "Shanghai")
    await scheduler.whenIdle()
    expect(run).toHaveBeenCalledTimes(1)

    store.setFieldValue("country", "US")
    await scheduler.whenIdle()
    expect(run).toHaveBeenCalledTimes(2)
    scope.dispose()
  })

  it("immediate 为 false 时应跳过首次任务", async () => {
    // 提供一个可变更触发字段的测试 Store。
    const store = createStore<DependencySchedulerTestValues>({
      initialValues: { country: "CN", city: "Beijing" },
    })

    // 组装公共 effect 所需的运行时依赖。
    const formApi = createTestFormApi(store)

    const scheduler = createScheduler()

    const context = createTestContext(formApi, scheduler)

    const scope = createRuntimeScope()

    // 记录后续字段变化产生的任务次数。
    const run = vi.fn(() => "resolved")

    createDepSchedulerEffect({
      context,
      triggerFields: ["country"],
      taskId: "test:non-immediate-dependency",
      scope,
      immediate: false,
      run,
    })
    await scheduler.whenIdle()

    expect(run).not.toHaveBeenCalled()

    store.setFieldValue("country", "US")
    await scheduler.whenIdle()
    expect(run).toHaveBeenCalledTimes(1)
    scope.dispose()
  })

  it("idle 优先级的首次任务不应阻塞关键空闲", async () => {
    const store = createStore<DependencySchedulerTestValues>({
      initialValues: { country: "CN", city: "Beijing" },
    })

    const formApi = createTestFormApi(store)

    const scheduler = createScheduler()

    const context = createTestContext(formApi, scheduler)

    const scope = createRuntimeScope()

    const run = vi.fn(() => "resolved")

    createDepSchedulerEffect({
      context,
      triggerFields: ["country"],
      taskId: "test:idle-dependency",
      scope,
      priority: "idle",
      run,
    })

    await expect(scheduler.whenIdle({ includeIdle: false })).resolves.toBe(true)
    expect(run).not.toHaveBeenCalled()

    await scheduler.whenIdle()
    expect(run).toHaveBeenCalledTimes(1)
    scope.dispose()
  })

  it("同一轮多次字段变化应按 taskId 合并", async () => {
    // 提供连续更新触发字段的测试 Store。
    const store = createStore<DependencySchedulerTestValues>({
      initialValues: { country: "CN", city: "Beijing" },
    })

    // 组装任务合并测试所需的运行时资源。
    const formApi = createTestFormApi(store)

    const scheduler = createScheduler()

    const context = createTestContext(formApi, scheduler)

    const scope = createRuntimeScope()

    // 记录初始任务和合并后的更新任务。
    const run = vi.fn(() => "resolved")

    createDepSchedulerEffect({
      context,
      triggerFields: ["country"],
      taskId: "test:coalesced-dependency",
      scope,
      run,
    })
    await scheduler.whenIdle()

    store.setFieldValue("country", "US")
    store.setFieldValue("country", "JP")
    await scheduler.whenIdle()

    expect(run).toHaveBeenCalledTimes(2)
    scope.dispose()
  })

  it("新任务应中止旧任务且只提交最新结果", async () => {
    // 提供可触发第二次异步任务的测试 Store。
    const store = createStore<DependencySchedulerTestValues>({
      initialValues: { country: "CN", city: "Beijing" },
    })

    // 组装异步竞态测试所需的运行时资源。
    const formApi = createTestFormApi(store)

    const scheduler = createScheduler()

    const context = createTestContext(formApi, scheduler)

    const scope = createRuntimeScope()

    // 保存每次任务的完成函数，以控制新旧任务的完成顺序。
    const resolvers: Array<(value: string) => void> = []

    // 保存每次任务收到的中止信号。
    const signals: AbortSignal[] = []

    // 创建由测试手动完成的异步任务。
    const run = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((resolve) => {
          signals.push(signal)
          resolvers.push(resolve)
        })
    )

    // 记录最终允许提交的任务结果。
    const onSuccess = vi.fn()

    createDepSchedulerEffect({
      context,
      triggerFields: ["country"],
      taskId: "test:abortable-dependency",
      scope,
      run,
      onSuccess,
    })

    store.setFieldValue("country", "US")
    await Promise.resolve()
    await Promise.resolve()

    expect(run).toHaveBeenCalledTimes(2)
    expect(signals[0]?.aborted).toBe(true)

    resolvers[1]?.("latest")
    resolvers[0]?.("stale")
    await scheduler.whenIdle()

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenLastCalledWith("latest")
    scope.dispose()
  })
})
