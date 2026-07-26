/**
 * Dependency 节点的运行时流程测试。
 *
 * 覆盖 dependencyIndex 的维护、effect 的创建/重建/销毁，以及 trigger 变化
 * 时 effect 的切换与 descriptor 更新。
 *
 * @module core/runtime/node/__tests__/dependencyFlow.test
 */

import { describe, expect, it, vi } from "vitest"

import { createRuntimeGraphHarness, flushRuntimeGraph } from "./runtimeGraphTestUtils"

// dependency 节点的挂载/更新/卸载流程：索引维护、effect 生命周期、竞态保障
describe("dependency flow", () => {
  it("dependencyIndex 跟随 dependency mount/update/unmount 维护触发字段反向查询", async () => {
    const { commitSchemas, context, root, scheduler } = createRuntimeGraphHarness()

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

    expect(
      context.nodeResources.dependencyIndex.getByTriggerField("mode" as any)
    ).toEqual([dependency])
    expect(dependency.effectState).toBeDefined()
    expect(dependency.dependencyDispose).toBeDefined()

    commitSchemas(root, [
      {
        key: "dep",
        to: ["kind"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(
      context.nodeResources.dependencyIndex.getByTriggerField("mode" as any)
    ).toEqual([])
    expect(
      context.nodeResources.dependencyIndex.getByTriggerField("kind" as any)
    ).toEqual([dependency])

    commitSchemas(root, [])
    await flushRuntimeGraph(scheduler)

    expect(
      context.nodeResources.dependencyIndex.getByTriggerField("kind" as any)
    ).toEqual([])
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

    const firstEffect = dependency.effectState
    const firstDispose = dependency.dependencyDispose
    expect(firstEffect).toBeDefined()
    expect(dependency.effectState).toBe(firstEffect)
    expect(firstDispose).toBeDefined()
    expect(firstDispose?.disposed).toBe(false)

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(dependency.effectState).toBe(firstEffect)
    expect(dependency.dependencyDispose).toBe(firstDispose)

    commitSchemas(root, [
      {
        key: "dep",
        to: ["kind"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(dependency.effectState).not.toBe(firstEffect)
    expect(firstDispose?.disposed).toBe(true)
    expect(dependency.dependencyDispose).not.toBe(firstDispose)
    expect(dependency.dependencyDispose?.disposed).toBe(false)
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

    const effectState = dependency.effectState
    const dependencyDispose = dependency.dependencyDispose

    expect(effectState).toBeDefined()
    expect(dependencyDispose).toBeDefined()

    commitSchemas(root, [])
    await flushRuntimeGraph(scheduler)

    expect(dependency.disposed.value).toBe(true)
    expect(dependency.effectState).toBeNull()
    expect(dependency.dependencyDispose).toBeNull()
    expect(dependencyDispose?.disposed).toBe(true)
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

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(secondRenderer).toHaveBeenCalled()
  })
})
