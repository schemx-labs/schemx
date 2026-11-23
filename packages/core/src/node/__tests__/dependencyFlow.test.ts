import { describe, expect, it, vi } from "vitest"

import { createRuntimeGraphHarness, flushRuntimeGraph } from "./runtimeGraphTestUtils"

describe("dependency flow", () => {
  it("trigger 不变时保留 dependency slot，trigger 变化时重建", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes[0]
    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    const firstSlot = dependency.dependencySlot

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["mode"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(dependency.dependencySlot).toBe(firstSlot)

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
        to: ["kind"],
        renderer: vi.fn().mockResolvedValue([]),
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(dependency.dependencySlot).not.toBe(firstSlot)
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
        componentType: "dependency",
        to: ["mode"],
        renderer: firstRenderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    commitSchemas(root, [
      {
        key: "dep",
        componentType: "dependency",
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
