/**
 * createViewState 单元测试
 *
 * 覆盖 createRootRuntimeViewState、createRuntimeViewState、deleteRuntimeViewState
 * 对 root/field/group/dependency 节点的 viewState 创建与注册。
 *
 * @module core/runtime/view/__tests__/createViewState
 */
import { describe, expect, it } from "vitest"

import { createContainerRuntimeState } from "../../container"
import { createFieldRuntimeState, setFieldDynamicOverrides } from "../../field"
import { createRuntimeResources } from "../../node/resources"
import {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "../../node/runtimeNode"
import { createScope } from "../../node/scope"
import { createComputed } from "../../../reactivity"
import {
  createRootRuntimeViewState,
  createRuntimeViewState,
  deleteRuntimeViewState,
} from "../createViewState"

import type {
  DependencyDescriptor,
  FieldDescriptor,
  GroupDescriptor,
} from "../../descriptor"

// 验证 createViewState 对 root/field/group/dependency 的 viewState 创建、更新、删除
describe("createViewState", () => {
  it("为 root 创建并注册 root viewState", () => {
    const resources = createRuntimeResources()
    const root = createRootRuntimeNode({ dispose: createScope() })

    const state = createRootRuntimeViewState(root, resources)

    expect(root.viewState).toBe(state)
  })

  it("为 field 创建并注册 field viewState", () => {
    const resources = createRuntimeResources()
    const node = createFieldRuntimeNode({
      id: 1,
      key: "field:name",
      dispose: createScope(),
    })
    const descriptor = createFieldDescriptor()

    node.fieldState = createFieldRuntimeState({
      nodeId: node.id,
      key: node.key,
      descriptor,
    })

    const state = createRuntimeViewState(node, descriptor, resources)

    expect(node.viewState).toBe(state)
    expect(node.viewState?.view.value?.key).toBe("field:name")
  })

  it("field viewState 跟随 fieldState.viewSchema computed 更新", () => {
    const resources = createRuntimeResources()
    const node = createFieldRuntimeNode({
      id: 1,
      key: "field:name",
      dispose: createScope(),
    })
    const descriptor = createFieldDescriptor({
      staticSchema: {
        name: "name",
        componentType: "input",
        label: "姓名",
        visible: true,
      },
    })
    const runtimeState = createFieldRuntimeState({
      nodeId: node.id,
      key: node.key,
      descriptor,
    })

    node.fieldState = runtimeState
    createRuntimeViewState(node, descriptor, resources)

    expect(node.viewState?.view.value?.visible).toBe(true)

    setFieldDynamicOverrides(
      runtimeState,
      { visible: false },
      { source: "dependencies", triggerFields: ["name" as never] }
    )

    expect(node.viewState?.view.value?.visible).toBe(false)
  })

  it("为 group 创建并注册 group viewState", () => {
    const resources = createRuntimeResources()
    const node = createGroupRuntimeNode({
      id: 1,
      key: "group:0",
      dispose: createScope(),
    })
    const descriptor = createGroupDescriptor()
    node.containerState = createContainerRuntimeState({
      nodeId: node.id,
      staticState: descriptor.staticState,
      inheritedState: createComputed(() => ({
        visible: true,
        readonly: false,
        disabled: false,
      })),
    })

    const state = createRuntimeViewState(node, descriptor, resources)

    expect(node.viewState).toBe(state)
    expect(node.viewState?.view.value?.key).toBe("group:0")
  })

  it("group 和 dependency viewState 透明组合 children viewSchemas", () => {
    const resources = createRuntimeResources()
    const root = createRootRuntimeNode({ dispose: createScope() })
    const group = createGroupRuntimeNode({
      id: 1,
      key: "group:0",
      dispose: createScope(),
    })
    const dependency = createDependencyRuntimeNode({
      id: 2,
      key: "dependency:0",
      dispose: createScope(),
    })
    const field = createFieldRuntimeNode({
      id: 3,
      key: "field:name",
      dispose: createScope(),
    })
    const fieldDescriptor = createFieldDescriptor()

    createRootRuntimeViewState(root, resources)
    const groupDescriptor = createGroupDescriptor()
    group.containerState = createContainerRuntimeState({
      nodeId: group.id,
      staticState: groupDescriptor.staticState,
      inheritedState: createComputed(() => ({
        visible: true,
        readonly: false,
        disabled: false,
      })),
    })
    createRuntimeViewState(group, groupDescriptor, resources)
    createRuntimeViewState(dependency, createDependencyDescriptor(), resources)

    field.fieldState = createFieldRuntimeState({
      nodeId: field.id,
      key: field.key,
      descriptor: fieldDescriptor,
    })
    createRuntimeViewState(field, fieldDescriptor, resources)

    dependency.childNodes.value = [field]
    group.childNodes.value = [dependency]
    root.childNodes.value = [group]
  })

  it("删除节点 viewState", () => {
    const resources = createRuntimeResources()
    const node = createFieldRuntimeNode({
      id: 1,
      key: "field:name",
      dispose: createScope(),
    })

    node.viewState = {} as never

    deleteRuntimeViewState(node, resources)

    expect(node.viewState).toBeNull()
  })
})

function createFieldDescriptor(
  overrides: Partial<FieldDescriptor> = {}
): FieldDescriptor {
  return {
    type: "field",
    key: "field:name",
    name: "name",
    componentType: "input",
    staticSchema: {
      name: "name",
      componentType: "input",
      label: "姓名",
    },
    ...overrides,
  } as FieldDescriptor
}

function createGroupDescriptor(): GroupDescriptor {
  return {
    type: "group",
    key: "group:0",
    staticSchema: {
      label: "分组",
    },
    staticState: {
      visible: true,
      readonly: false,
      disabled: false,
    },
    children: [],
  } as GroupDescriptor
}

function createDependencyDescriptor(): DependencyDescriptor {
  return {
    type: "dependency",
    key: "dependency:0",
    triggerFields: ["type"],
    renderer: () => [],
  } as unknown as DependencyDescriptor
}
