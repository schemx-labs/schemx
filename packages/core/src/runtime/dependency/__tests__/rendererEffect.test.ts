/**
 * Dependency effect（依赖渲染节点）的行为测试。
 *
 * 覆盖 dependency 节点的 schema 渲染、子节点提交、竞态处理、renderer 失败
 * 回退以及空/group schema 输出等场景。
 *
 * @module core/runtime/dependency/__tests__/rendererEffect
 */

import { describe, expect, it, vi } from "vitest"

import {
  createRawFieldSchema,
  createRuntimeGraphHarness,
  flushRuntimeGraph,
} from "./dependencyRuntimeTestUtils"
import * as dependencyModule from "../index"

// 依赖渲染器（dependency effect）的核心行为：子 schema 渲染与提交
describe("dependency renderer effect", () => {
  it("只导出 createDependencyRendererEffect 作为 renderer effect 创建入口", () => {
    expect(dependencyModule).toHaveProperty("createDependencyRendererEffect")
    expect(dependencyModule).not.toHaveProperty("mountDependencyRendererEffect")
  })

  it("renderer 返回的子 schema 会编译后通过 commit boundary 写入 dependency childNodes", async () => {
    const renderer = vi.fn().mockResolvedValue([createRawFieldSchema("child", "child")])
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness()

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
    expect(dependency.childNodes.value).toHaveLength(1)
    expect(dependency.childNodes.value[0]?.key).toBe("child")
    expect(dependency.childNodes.value[0]?.type).toBe("field")
  })

  it("renderer 返回 group schema 时应保留 group children", async () => {
    const renderer = vi.fn((values: { orderType?: string }) => {
      if (values.orderType !== "express") {
        return []
      }

      return [
        {
          label: "加急订单配置",
          children: [
            {
              name: "expressLevel",
              label: "加急等级",
              componentType: "selector",
            },
          ],
        },
      ]
    })
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { orderType: "standard" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        to: ["orderType"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    formApi.setValue("orderType" as any, "express")
    await flushRuntimeGraph(scheduler)

    const dependency = root.childNodes.value[0]
    expect(dependency?.type).toBe("dependency")
    if (dependency?.type !== "dependency") {
      throw new Error("expected dependency node")
    }

    const group = dependency.childNodes.value[0]

    expect(renderer).toHaveBeenCalledTimes(2)
    expect(group?.type).toBe("group")
    if (group?.type !== "group") {
      throw new Error("expected group node")
    }
    expect(group.childNodes.value.map((child) => child.key)).toEqual([
      "field:group:0/expressLevel",
    ])
  })

  it("renderer 返回相同 child schema 引用时应复用节点配置", async () => {
    const childSchema = createRawFieldSchema("child", "child")
    const renderer = vi.fn(() => [childSchema])
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "a" }
    )

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

    const firstChild = dependency.childNodes.value[0]
    const firstConfigToken = firstChild?.configToken

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(dependency.childNodes.value[0]).toBe(firstChild)
    expect(dependency.childNodes.value[0]?.configToken).toBe(firstConfigToken)
  })

  it("外部 compiler 失效后 renderer 应复用子节点并更新配置", async () => {
    const childSchema = createRawFieldSchema("child", "child")
    const renderer = vi.fn(() => [childSchema])
    const { commitSchemas, context, formApi, root, scheduler } =
      createRuntimeGraphHarness({}, { mode: "a" })

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

    const firstChild = dependency.childNodes.value[0]
    const firstConfigToken = firstChild?.configToken

    context.compile.invalidate()

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)
    formApi.setValue("mode" as any, "c")
    await flushRuntimeGraph(scheduler)

    expect(dependency.childNodes.value[0]).toBe(firstChild)
    expect(dependency.childNodes.value[0]?.configToken).not.toBe(firstConfigToken)
  })

  it("空 renderer 输出会提交为空子树", async () => {
    const renderer = vi
      .fn()
      .mockResolvedValueOnce([createRawFieldSchema("child", "child")])
      .mockResolvedValueOnce([])
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "a" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes.value[0]?.type).toBe("dependency")
    if (root.childNodes.value[0]?.type !== "dependency") {
      throw new Error("expected dependency node")
    }
    expect(root.childNodes.value[0].childNodes.value).toHaveLength(1)

    formApi.setValue("mode" as any, "b")
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes.value[0].childNodes.value).toHaveLength(0)
  })

  it("失败的 renderer 不会覆盖上一次成功提交的 dependency children", async () => {
    const error = new Error("boom")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const renderer = vi
      .fn()
      .mockResolvedValueOnce([createRawFieldSchema("stable", "stable")])
      .mockRejectedValueOnce(error)
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "a" }
    )

    try {
      commitSchemas(root, [
        {
          key: "dep",
          to: ["mode"],
          renderer,
        },
      ])
      await flushRuntimeGraph(scheduler)

      formApi.setValue("mode" as any, "b")
      await flushRuntimeGraph(scheduler)

      expect(root.childNodes.value[0]?.type).toBe("dependency")
      if (root.childNodes.value[0]?.type !== "dependency") {
        throw new Error("expected dependency node")
      }
      expect(root.childNodes.value[0].childNodes.value.map((child) => child.key)).toEqual([
        "stable",
      ])
      expect(consoleError).toHaveBeenCalledWith(
        '[schemx] Dependency Schema "dep" renderer 执行错误',
        error
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it("旧 renderer 晚于新 renderer 完成时不会覆盖最新 dependency children", async () => {
    let resolveSlowRenderer!: (schemas: any[]) => void
    const slowRenderer = new Promise<any[]>((resolve) => {
      resolveSlowRenderer = resolve
    })
    const renderer = vi
      .fn()
      .mockResolvedValueOnce([createRawFieldSchema("initial", "initial")])
      .mockImplementationOnce(() => slowRenderer)
      .mockResolvedValueOnce([createRawFieldSchema("latest", "latest")])
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      {},
      { mode: "initial" }
    )

    commitSchemas(root, [
      {
        key: "dep",
        to: ["mode"],
        renderer,
      },
    ])
    await flushRuntimeGraph(scheduler)

    formApi.setValue("mode" as any, "slow")
    await Promise.resolve()

    formApi.setValue("mode" as any, "latest")
    await Promise.resolve()

    resolveSlowRenderer([createRawFieldSchema("stale", "stale")])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes.value[0]?.type).toBe("dependency")
    if (root.childNodes.value[0]?.type !== "dependency") {
      throw new Error("expected dependency node")
    }
    expect(root.childNodes.value[0].childNodes.value.map((child) => child.key)).toEqual([
      "latest",
    ])
  })
})
