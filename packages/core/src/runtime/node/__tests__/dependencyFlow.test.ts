/**
 * Dependency 节点的运行时流程测试。
 *
 * 覆盖 renderer effect 的创建、重建、销毁，以及 trigger 变化时的切换。
 *
 * @module core/runtime/node/__tests__/dependencyFlow.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeGraphHarness, flushRuntimeGraph } from "./runtimeGraphTestUtils"

// dependency 节点的挂载/更新/卸载流程：renderer effect 生命周期与竞态保障。
describe("dependency flow", () => {
  it("dependency mount/update/unmount 正确维护 renderer effect", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes.value[0]

    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    expect(dependency.rendererEffect).toBeDefined()

    commitSchemas(root, [
      {
        key: "dep",
        to: ["kind"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(dependency.rendererEffect).toBeDefined()

    commitSchemas(root, [])
    await flushRuntimeGraph(scheduler)

    expect(dependency.rendererEffect).toBeNull()
  })

  it("trigger 不变时保留 dependency effect，trigger 变化时重建", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness()

    const renderer = vi.fn().mockResolvedValue([])

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes.value[0]

    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    const firstEffect = dependency.rendererEffect

    expect(firstEffect).toBeDefined()
    expect(dependency.rendererEffect).toBe(firstEffect)

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(dependency.rendererEffect).toBe(firstEffect)

    commitSchemas(root, [
      {
        key: "dep",
        to: ["kind"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(dependency.rendererEffect).not.toBe(firstEffect)
  })

  it("dependency unmount 会清空 node-local effect 资源", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes.value[0]

    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    const rendererEffect = dependency.rendererEffect

    expect(rendererEffect).toBeDefined()

    commitSchemas(root, [])
    await flushRuntimeGraph(scheduler)

    expect(dependency.disposed.value).toBe(true)
    expect(dependency.rendererEffect).toBeNull()
  })

  it("trigger 不变但 renderer 变化时，下一次执行使用最新 descriptor", async () => {
    const firstRenderer = vi.fn().mockResolvedValue([])

    const secondRenderer = vi.fn().mockResolvedValue([])

    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "a" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer: firstRenderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer: secondRenderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    formApi.setFieldValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(secondRenderer).toHaveBeenCalled()
  })
})
