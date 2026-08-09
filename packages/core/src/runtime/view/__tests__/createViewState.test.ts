/**
 * createViewState 单元测试。
 *
 * 覆盖 root、field、group、dependency 节点的 viewState 创建、组合与删除。
 *
 * @module core/runtime/view/__tests__/createViewState.test
 */

import { describe, expect, it } from "vitest"

import { createComputed } from "../../../reactivity"
import { createFieldRuntimeState, setFieldDynamicOverrides } from "../../field"
import {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "../../node/runtimeNode"
import { createScope } from "../../node/scope"
import { createPresentationRuntimeState } from "../../presentation"
import {
  createRootRuntimeViewState,
  createRuntimeViewState,
  deleteRuntimeViewState,
} from "../createViewState"

import type { SchemxResolvedBaseField } from "../../../types"
import type {
  DependencyRuntimeNodeInput,
  FieldRuntimeNodeInput,
  GroupRuntimeNodeInput,
} from "../../node"

// 验证 createViewState 对各类 RuntimeNode 的 viewState 创建、更新与删除。
describe("createViewState", () => {
  it("为 root 创建并注册 root viewState", () => {
    const root = createRootRuntimeNode({ dispose: createScope() })

    const state = createRootRuntimeViewState(root)

    expect(root.viewState).toBe(state)
  })

  it("为 field 创建并注册 field viewState", () => {
    const input = createFieldInput()

    const node = createFieldRuntimeNode({ id: 1, input, dispose: createScope() })

    node.fieldState = createFieldRuntimeState({
      nodeId: node.id,
      key: node.key,
      name: node.name,
      staticSchema: node.staticSchema,
    })

    const state = createRuntimeViewState(node)

    expect(node.viewState).toBe(state)
    expect(node.viewState?.view.value?.key).toBe("field:name")
  })

  it("field viewState 跟随 effectiveSchema computed 更新", () => {
    const input = createFieldInput({ label: "姓名", visible: true })

    const node = createFieldRuntimeNode({ id: 1, input, dispose: createScope() })

    const runtimeState = createFieldRuntimeState({
      nodeId: node.id,
      key: node.key,
      name: node.name,
      staticSchema: node.staticSchema,
    })

    node.fieldState = runtimeState
    createRuntimeViewState(node)

    expect(node.viewState?.view.value?.visible).toBe(true)

    setFieldDynamicOverrides(
      runtimeState,
      { visible: false },
      { source: "dependencies", triggerFields: ["name" as never] }
    )

    expect(node.viewState?.view.value?.visible).toBe(false)
  })

  it("field viewState 保留 componentProps 原始引用和原型", () => {
    const componentProps = Object.assign(Object.create({ inherited: true }), {
      "data-test": "field",
    })

    const input = createFieldInput({ componentProps: componentProps as never })

    const node = createFieldRuntimeNode({ id: 1, input, dispose: createScope() })

    node.fieldState = createFieldRuntimeState({
      nodeId: node.id,
      key: node.key,
      name: node.name,
      staticSchema: node.staticSchema,
    })
    createRuntimeViewState(node)

    const viewProps = node.viewState?.view.value?.componentProps

    expect(viewProps).toBe(componentProps)
    expect(Object.getPrototypeOf(viewProps)).toBe(Object.getPrototypeOf(componentProps))
  })

  it("为 group 创建并注册 group viewState", () => {
    const input = createGroupInput()

    const node = createGroupRuntimeNode({ id: 1, input, dispose: createScope() })

    node.presentationState = createPresentationRuntimeState({
      nodeId: node.id,
      staticState: node.staticState,
      inheritedState: createInheritedState(),
    })

    const state = createRuntimeViewState(node)

    expect(node.viewState).toBe(state)
    expect(node.viewState?.view.value?.key).toBe("group:0")
    expect(node.viewState?.view.value?.debug).toBeUndefined()
  })

  it("debug 模式为 group view 附加调试元数据", () => {
    const node = createGroupRuntimeNode({
      id: 1,
      input: createGroupInput(),
      dispose: createScope(),
    })

    node.presentationState = createPresentationRuntimeState({
      nodeId: node.id,
      staticState: node.staticState,
      inheritedState: createInheritedState(),
    })

    createRuntimeViewState(node, true)

    expect(node.viewState?.view.value?.debug).toMatchObject({
      runtimeNodeId: 1,
      runtimeNodeType: "group",
    })
  })

  it("group 和 dependency viewState 透明组合 children viewSchemas", () => {
    const root = createRootRuntimeNode({ dispose: createScope() })

    const group = createGroupRuntimeNode({
      id: 1,
      input: createGroupInput(),
      dispose: createScope(),
    })

    const dependency = createDependencyRuntimeNode({
      id: 2,
      input: createDependencyInput(),
      dispose: createScope(),
    })

    const field = createFieldRuntimeNode({
      id: 3,
      input: createFieldInput(),
      dispose: createScope(),
    })

    createRootRuntimeViewState(root)
    group.presentationState = createPresentationRuntimeState({
      nodeId: group.id,
      staticState: group.staticState,
      inheritedState: createInheritedState(),
    })
    createRuntimeViewState(group)
    createRuntimeViewState(dependency)

    field.fieldState = createFieldRuntimeState({
      nodeId: field.id,
      key: field.key,
      name: field.name,
      staticSchema: field.staticSchema,
    })
    createRuntimeViewState(field)

    dependency.childNodes.value = [field]
    group.childNodes.value = [dependency]
    root.childNodes.value = [group]

    expect(root.viewState?.viewSchemas.value.map((schema) => schema.key)).toEqual([
      "group:0",
    ])
    expect(group.viewState?.view.value?.children.map((schema) => schema.key)).toEqual([
      "field:name",
    ])
  })

  it("删除节点 viewState", () => {
    const node = createFieldRuntimeNode({
      id: 1,
      input: createFieldInput(),
      dispose: createScope(),
    })

    node.viewState = {} as never

    deleteRuntimeViewState(node)

    expect(node.viewState).toBeNull()
  })
})

function createFieldInput(
  overrides: Partial<SchemxResolvedBaseField> = {}
): FieldRuntimeNodeInput {
  const staticSchema = {
    name: "name",
    componentType: "input",
    label: "姓名",
    visible: true,
    readonly: false,
    disabled: false,
    required: false,
    placeholder: "请输入姓名",
    componentProps: {},
    rules: [],
    validationTrigger: "onChange",
    ...overrides,
  } as SchemxResolvedBaseField

  return {
    type: "field",
    key: "field:name",
    configToken: Symbol("field:name"),
    name: "name",
    componentType: "input",
    staticSchema,
    dynamicProps: null,
    validation: null,
  }
}

function createGroupInput(): GroupRuntimeNodeInput {
  return {
    type: "group",
    key: "group:0",
    configToken: Symbol("group:0"),
    staticSchema: { label: "分组", children: [] } as never,
    staticState: { visible: true, readonly: false, disabled: false },
    dynamicProps: null,
  }
}

function createDependencyInput(): DependencyRuntimeNodeInput {
  return {
    type: "dependency",
    key: "dependency:0",
    configToken: Symbol("dependency:0"),
    triggerFields: ["type"],
    renderer: () => [],
    rendererIdentity: () => [],
    staticState: { visible: true, readonly: false, disabled: false },
    dynamicProps: null,
  }
}

function createInheritedState() {
  return createComputed(() => ({
    visible: true,
    readonly: false,
    disabled: false,
  }))
}
