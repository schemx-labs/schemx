/**
 * 通用动态属性 effect 的测试。
 *
 * 覆盖 triggerFields 的精确订阅及用户回调读取表单值时的依赖隔离。
 *
 * @module core/runtime/dynamicProps/__tests__/effect
 */

import { describe, expect, it, vi } from "vitest"

import { createStore } from "../../../store"
import { createRuntimeScope } from "../../node/scope"
import { createScheduler } from "../../scheduler"
import { createDynamicPropsEffect } from "../effect"

import type { SchemaRuntimeContext } from "../../context"
import type { SchemxFormApi } from "../../../types"

/**
 * 动态属性测试使用的表单值。
 */
interface DynamicPropsTestValues {
  country: string
  city: string
}

describe("createDynamicPropsEffect", () => {
  it("应只订阅 triggerFields，不追踪全量快照和用户回调读取", async () => {
    // 提供具有真实字段级 signal 的 Store，以验证订阅边界。
    const store = createStore<DynamicPropsTestValues>({
      initialValues: { country: "CN", city: "Beijing" },
    })

    // 跟踪动态属性条件函数的执行次数。
    const visible = vi.fn((_values, form: SchemxFormApi<DynamicPropsTestValues>) => {
      void form.getValue("city")

      return true
    })

    // 跟踪 trigger 回调的执行次数。
    const trigger = vi.fn((_values, form: SchemxFormApi<DynamicPropsTestValues>) => {
      void form.getValue("city")
    })

    // 依赖配置同时覆盖动态属性和副作用两类用户回调。
    const dependencies = {
      triggerFields: ["country"] as const,
      visible,
      trigger,
    }

    // 仅提供 effect 测试所需的表单读取能力。
    const formApi = {
      getValue: store.getFieldValue.bind(store),
      getValues: store.getFieldsValue.bind(store),
    } as unknown as SchemxFormApi<DynamicPropsTestValues>

    // 跟踪 effect 生命周期的运行时作用域。
    const scope = createRuntimeScope()

    // 等待异步动态属性任务完成的调度器。
    const scheduler = createScheduler()

    // 为通用 effect 组装最小运行时上下文。
    const context = {
      formApi,
      scheduler,
    } as SchemaRuntimeContext<DynamicPropsTestValues>

    createDynamicPropsEffect<DynamicPropsTestValues, { visible: boolean }>({
      context,
      dependencies,
      triggerFields: dependencies.triggerFields,
      propKeys: ["visible"],
      scope,
      onSuccess: vi.fn(),
    })
    await scheduler.whenIdle()

    expect(visible).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledTimes(1)

    store.setFieldValue("city", "Shanghai")
    await scheduler.whenIdle()

    expect(visible).toHaveBeenCalledTimes(1)
    expect(trigger).toHaveBeenCalledTimes(1)

    store.setFieldValue("country", "US")
    await scheduler.whenIdle()

    expect(visible).toHaveBeenCalledTimes(2)
    expect(trigger).toHaveBeenCalledTimes(2)
    scope.dispose()
  })
})
