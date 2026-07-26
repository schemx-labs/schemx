/**
 * 容器状态运行时集成测试。
 *
 * 覆盖 Group/Dependency 状态继承、动态依赖、结构 effect 隔离和校验联动。
 *
 * @module core/runtime/container/__tests__/containerStateFlow
 */

import { describe, expect, it, vi } from "vitest"

import {
  createRuntimeGraphHarness,
  flushRuntimeGraph,
} from "../../node/__tests__/runtimeGraphTestUtils"

import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
} from "../../node"
import type { SchemxField } from "../../../types"

describe("容器状态运行时链路", () => {
  it("嵌套 Group 和 Dependency 状态应递归约束后代字段", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        readonly: true,
        children: [
          {
            key: "dynamic",
            to: ["mode"],
            disabled: true,
            renderer: () => [
              {
                name: "name",
                label: "姓名",
                componentType: "input",
                readonly: false,
                disabled: false,
              },
            ],
          },
        ],
      },
    ] as SchemxField[])

    await flushRuntimeGraph(scheduler)

    const group = expectGroup(root.childNodes.value[0])
    const dependency = expectDependency(group.childNodes.value[0])
    const field = expectField(dependency.childNodes.value[0])

    expect(group.containerState?.effectiveState.value).toEqual({
      visible: true,
      readonly: true,
      disabled: false,
    })
    expect(dependency.containerState?.effectiveState.value).toEqual({
      visible: true,
      readonly: true,
      disabled: true,
    })
    expect(field.fieldState?.effectiveSchema.value).toMatchObject({
      visible: true,
      readonly: true,
      disabled: true,
    })
  })

  it("Group dependencies 应更新后代状态并同步校验注册", async () => {
    const { commitSchemas, context, formApi, root, scheduler } =
      createRuntimeGraphHarness(undefined, { show: true })

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        dependencies: {
          triggerFields: ["show"],
          visible: (values) => Boolean((values as any).show),
        },
        children: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
            required: true,
          },
        ],
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    const group = expectGroup(root.childNodes.value[0])
    const field = expectField(group.childNodes.value[0])

    expect(field.fieldState?.effectiveSchema.value.visible).toBe(true)

    formApi.setValue("show", false)
    await flushRuntimeGraph(scheduler)

    expect(group.containerState?.effectiveState.value.visible).toBe(false)
    expect(field.fieldState?.effectiveSchema.value.visible).toBe(false)
    expect(context.validation.removeField).toHaveBeenCalledWith("name")
  })

  it("Dependency 状态更新不应重建结构 effect 或 children", async () => {
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      undefined,
      { mode: "enterprise", status: "active" }
    )
    const renderer = vi.fn(() => [
      {
        name: "companyName",
        label: "企业名称",
        componentType: "input",
      },
    ])

    commitSchemas(root, [
      {
        key: "enterprise-fields",
        to: ["mode"],
        dependencies: {
          triggerFields: ["status"],
          visible: (values) => (values as any).status === "active",
        },
        renderer,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    const dependency = expectDependency(root.childNodes.value[0])
    const firstEffect = dependency.effectState
    const firstChild = expectField(dependency.childNodes.value[0])
    const initialRenderCount = renderer.mock.calls.length

    commitSchemas(root, [
      {
        key: "enterprise-fields",
        to: ["mode"],
        readonly: true,
        dependencies: {
          triggerFields: ["status"],
          visible: (values) => (values as any).status === "active",
        },
        renderer,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    expect(dependency.effectState).toBe(firstEffect)
    expect(dependency.childNodes.value[0]).toBe(firstChild)
    expect(firstChild.fieldState?.effectiveSchema.value.readonly).toBe(true)

    formApi.setValue("status", "deleted")
    await flushRuntimeGraph(scheduler)

    expect(dependency.effectState).toBe(firstEffect)
    expect(dependency.childNodes.value[0]).toBe(firstChild)
    expect(renderer).toHaveBeenCalledTimes(initialRenderCount)
    expect(firstChild.fieldState?.effectiveSchema.value.visible).toBe(false)

    formApi.setValue("mode", "personal")
    await flushRuntimeGraph(scheduler)

    expect(renderer.mock.calls.length).toBeGreaterThan(initialRenderCount)
    expect(dependency.containerState?.effectiveState.value.visible).toBe(false)
  })

  it("Dependency renderer 变化时应重建结构 effect", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness(undefined, {
      mode: "enterprise",
    })
    const firstRenderer = vi.fn(() => [
      { name: "companyName", label: "企业名称", componentType: "input" },
    ])
    const nextRenderer = vi.fn(() => [
      { name: "personalName", label: "个人姓名", componentType: "input" },
    ])

    commitSchemas(root, [
      {
        key: "dynamic-fields",
        to: ["mode"],
        renderer: firstRenderer,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    const dependency = expectDependency(root.childNodes.value[0])
    const firstEffect = dependency.effectState

    commitSchemas(root, [
      {
        key: "dynamic-fields",
        to: ["mode"],
        renderer: nextRenderer,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes.value[0]).toBe(dependency)
    expect(dependency.effectState).not.toBe(firstEffect)
    expect(nextRenderer).toHaveBeenCalled()
    expect(expectField(dependency.childNodes.value[0]).descriptor.name).toBe(
      "personalName"
    )
  })

  it("移除容器 dependencies 后应清空旧动态覆盖", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness(undefined, {
      show: false,
    })
    const children: SchemxField[] = [
      { name: "name", label: "姓名", componentType: "input" },
    ]

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        dependencies: {
          triggerFields: ["show"],
          visible: (values) => Boolean((values as any).show),
        },
        children,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    const group = expectGroup(root.childNodes.value[0])
    expect(group.containerState?.effectiveState.value.visible).toBe(false)

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        children,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes.value[0]).toBe(group)
    expect(group.containerState?.dynamicOverrides.value).toEqual({})
    expect(group.containerState?.effectiveState.value.visible).toBe(true)
  })

  it("容器 dependencies 引用未变化时应复用状态 effect", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness(undefined, {
      show: false,
    })
    const visible = vi.fn((values: any) => Boolean(values.show))
    const dependencies = {
      triggerFields: ["show"],
      visible,
    }

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        dependencies,
        children: [],
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    const group = expectGroup(root.childNodes.value[0])
    const firstEffectScope = group.containerEffectDispose
    const initialCallCount = visible.mock.calls.length

    commitSchemas(root, [
      {
        key: "profile",
        label: "更新后的资料",
        readonly: true,
        dependencies,
        children: [],
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    expect(group.containerEffectDispose).toBe(firstEffectScope)
    expect(visible).toHaveBeenCalledTimes(initialCallCount)
    expect(group.containerState?.effectiveState.value).toMatchObject({
      visible: false,
      readonly: true,
    })
  })

  it("容器 dependencies 更新时应保留旧覆盖直到新结果完成", async () => {
    const { commitSchemas, root, scheduler } = createRuntimeGraphHarness(undefined, {
      show: false,
    })
    let resolveNext!: (visible: boolean) => void

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        dependencies: {
          triggerFields: ["show"],
          visible: () => false,
        },
        children: [],
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    const group = expectGroup(root.childNodes.value[0])
    expect(group.containerState?.effectiveState.value.visible).toBe(false)

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        dependencies: {
          triggerFields: ["show"],
          visible: () =>
            new Promise<boolean>((resolve) => {
              resolveNext = resolve
            }),
        },
        children: [],
      },
    ] as SchemxField[])

    expect(group.containerState?.effectiveState.value.visible).toBe(false)

    resolveNext(true)
    await flushRuntimeGraph(scheduler)

    expect(group.containerState?.effectiveState.value.visible).toBe(true)
  })

  it("容器异步 dependencies 的旧结果不能覆盖最新状态", async () => {
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      undefined,
      { mode: "initial" }
    )
    const requests: Array<{
      mode: unknown
      resolve: (visible: boolean) => void
    }> = []

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        dependencies: {
          triggerFields: ["mode"],
          visible: (values) =>
            new Promise<boolean>((resolve) => {
              requests.push({ mode: (values as any).mode, resolve })
            }),
        },
        children: [],
      },
    ] as SchemxField[])

    await vi.waitFor(() => expect(requests).toHaveLength(1))
    requests[0].resolve(true)
    await flushRuntimeGraph(scheduler)

    formApi.setValue("mode", "old")
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    formApi.setValue("mode", "latest")
    await vi.waitFor(() => expect(requests).toHaveLength(3))

    requests[2].resolve(true)
    requests[1].resolve(false)
    await flushRuntimeGraph(scheduler)

    const group = expectGroup(root.childNodes.value[0])
    expect(group.containerState?.effectiveState.value.visible).toBe(true)
  })
})

function expectGroup(node: unknown): GroupRuntimeNode {
  if (!node || (node as GroupRuntimeNode).type !== "group") {
    throw new Error("expected group runtime node")
  }

  return node as GroupRuntimeNode
}

function expectDependency(node: unknown): DependencyRuntimeNode {
  if (!node || (node as DependencyRuntimeNode).type !== "dependency") {
    throw new Error("expected dependency runtime node")
  }

  return node as DependencyRuntimeNode
}

function expectField(node: unknown): FieldRuntimeNode {
  if (!node || (node as FieldRuntimeNode).type !== "field") {
    throw new Error("expected field runtime node")
  }

  return node as FieldRuntimeNode
}
