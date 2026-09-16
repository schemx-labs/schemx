/**
 * 呈现状态运行时集成测试。
 *
 * 覆盖 Group/Dependency 状态继承、动态依赖、结构 effect 隔离和校验联动。
 *
 * @module core/runtime/presentation/__tests__/presentationStateFlow
 */

import { describe, expect, it, vi } from "vitest"

import {
  createRuntimeGraphHarness,
  flushRuntimeGraph,
} from "../../node/__tests__/graphTestUtils"
import { isDependencyNode, isFieldNode, isGroupNode } from "../../node/helper"

import type { SchemxField } from "../../../types"
import type { DependencyNode, FieldNode, GroupNode } from "../../node"

describe("呈现状态运行时链路", () => {
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

    expect(group.presentationState.value).toEqual({
      visible: true,
      readonly: true,
      disabled: false,
    })
    expect(dependency.presentationState.value).toEqual({
      visible: true,
      readonly: true,
      disabled: true,
    })
    expect(field.resolvedSchema.value).toMatchObject({
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

    expect(field.resolvedSchema.value.visible).toBe(true)

    formApi.setFieldValue("show", false)
    await flushRuntimeGraph(scheduler)

    expect(group.presentationState.value.visible).toBe(false)
    expect(field.resolvedSchema.value.visible).toBe(false)
    expect(context.validation.removeField).toHaveBeenCalledWith("name")
  })

  it("容器 dependencies 的 trigger 应随触发字段变化执行", async () => {
    const { commitSchemas, formApi, root, scheduler } = createRuntimeGraphHarness(
      undefined,
      { mode: "initial" }
    )

    // 记录 Group 依赖副作用的执行参数。
    const groupTrigger = vi.fn()

    // 记录 Dependency 依赖副作用的执行参数。
    const dependencyTrigger = vi.fn()

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        dependencies: {
          triggerFields: ["mode"],
          trigger: groupTrigger,
        },
        children: [],
      },
      {
        key: "dynamic-fields",
        to: ["mode"],
        dependencies: {
          triggerFields: ["mode"],
          trigger: dependencyTrigger,
        },
        renderer: () => [],
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    expect(groupTrigger).toHaveBeenLastCalledWith({ mode: "initial" }, formApi)
    expect(dependencyTrigger).toHaveBeenLastCalledWith({ mode: "initial" }, formApi)

    formApi.setFieldValue("mode", "updated")
    await flushRuntimeGraph(scheduler)

    expect(groupTrigger).toHaveBeenLastCalledWith({ mode: "updated" }, formApi)
    expect(dependencyTrigger).toHaveBeenLastCalledWith({ mode: "updated" }, formApi)
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

    const firstEffect = dependency.rendererEffect

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

    expect(dependency.rendererEffect).toBe(firstEffect)
    expect(dependency.childNodes.value[0]).toBe(firstChild)
    expect(firstChild.resolvedSchema.value.readonly).toBe(true)

    formApi.setFieldValue("status", "deleted")
    await flushRuntimeGraph(scheduler)

    expect(dependency.rendererEffect).toBe(firstEffect)
    expect(dependency.childNodes.value[0]).toBe(firstChild)
    expect(renderer).toHaveBeenCalledTimes(initialRenderCount)
    expect(firstChild.resolvedSchema.value.visible).toBe(false)

    formApi.setFieldValue("mode", "personal")
    await flushRuntimeGraph(scheduler)

    expect(renderer.mock.calls.length).toBeGreaterThan(initialRenderCount)
    expect(dependency.presentationState.value.visible).toBe(false)
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

    const firstEffect = dependency.rendererEffect

    commitSchemas(root, [
      {
        key: "dynamic-fields",
        to: ["mode"],
        renderer: nextRenderer,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes.value[0]).toBe(dependency)
    expect(dependency.rendererEffect).not.toBe(firstEffect)
    expect(nextRenderer).toHaveBeenCalled()
    expect(expectField(dependency.childNodes.value[0]).name.value).toBe("personalName")
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

    expect(group.presentationState.value.visible).toBe(false)

    commitSchemas(root, [
      {
        key: "profile",
        label: "资料",
        children,
      },
    ] as SchemxField[])
    await flushRuntimeGraph(scheduler)

    expect(root.childNodes.value[0]).toBe(group)
    expect(group.dependencyOverrides.value).toEqual({})
    expect(group.presentationState.value.visible).toBe(true)
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

    const firstEffectScope = group.presentationEffectScope

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

    expect(group.presentationEffectScope).toBe(firstEffectScope)
    expect(visible).toHaveBeenCalledTimes(initialCallCount)
    expect(group.presentationState.value).toMatchObject({
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

    expect(group.presentationState.value.visible).toBe(false)

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

    expect(group.presentationState.value.visible).toBe(false)

    await vi.waitFor(() => expect(resolveNext).toEqual(expect.any(Function)))
    resolveNext(true)
    await flushRuntimeGraph(scheduler)

    expect(group.presentationState.value.visible).toBe(true)
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

    formApi.setFieldValue("mode", "old")
    await vi.waitFor(() => expect(requests).toHaveLength(2))
    formApi.setFieldValue("mode", "latest")
    await vi.waitFor(() => expect(requests).toHaveLength(3))

    requests[2].resolve(true)
    requests[1].resolve(false)
    await flushRuntimeGraph(scheduler)

    const group = expectGroup(root.childNodes.value[0])

    expect(group.presentationState.value.visible).toBe(true)
  })
})

/**
 * 将未知运行时节点断言为 Group 节点。
 *
 * @param node - 待断言的运行时节点。
 * @returns Group 运行时节点。
 * @throws 节点类型不是 Group 时抛出测试错误。
 */
function expectGroup(node: unknown): GroupNode {
  if (!isGroupNode(node as GroupNode | undefined)) {
    throw new Error("expected group runtime node")
  }

  return node as GroupNode
}

/**
 * 将未知运行时节点断言为 Dependency 节点。
 *
 * @param node - 待断言的运行时节点。
 * @returns Dependency 运行时节点。
 * @throws 节点类型不是 Dependency 时抛出测试错误。
 */
function expectDependency(node: unknown): DependencyNode {
  if (!isDependencyNode(node as DependencyNode | undefined)) {
    throw new Error("expected dependency runtime node")
  }

  return node as DependencyNode
}

/**
 * 将未知运行时节点断言为 Field 节点。
 *
 * @param node - 待断言的运行时节点。
 * @returns Field 运行时节点。
 * @throws 节点类型不是 Field 时抛出测试错误。
 */
function expectField(node: unknown): FieldNode {
  if (!isFieldNode(node as FieldNode | undefined)) {
    throw new Error("expected field runtime node")
  }

  return node as FieldNode
}
