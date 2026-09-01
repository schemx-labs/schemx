/**
 * createViewSchemas 单元测试。
 *
 * 覆盖 root、field、group、dependency 节点的 ViewSchema 创建、组合与清理。
 *
 * @module core/runtime/view/__tests__/createViewSchemas.test
 */

import { describe, expect, it } from "vitest"

import {
  createDependencyNode,
  createFieldNode,
  createGroupNode,
  createRootNode,
} from "../../node/__tests__/nodeTestUtils"
import { setFieldDynamicOverrides } from "../../node/__tests__/signalsTestUtils"
import { createNodeManager } from "../../node/nodeManager"
import { createScope } from "../../node/scope"
import {
  clearRuntimeViewSchemas,
  createRootRuntimeViewSchemas,
  createRuntimeViewSchemas,
} from "../createViewSchemas"
import { isSchemxViewFieldSchema } from "../helper"

import type {
  SchemxBaseField,
  SchemxDependencyField,
  SchemxResolvedBaseField,
} from "../../../types"
// 验证 createViewSchemas 对各类 Node 的 ViewSchema 创建、更新与清理。
describe("createViewSchemas", () => {
  it("为 root 创建并注册 root viewSchemas", () => {
    const root = createRootNode({ scope: createScope() })

    createRootRuntimeViewSchemas(root)

    expect(root.viewSchemas).not.toBeNull()
  })

  it("为 field 创建并注册 field viewSchemas", () => {
    const nodeOptions = createFieldNodeOptions()

    const node = createFieldNode({
      id: 1,
      ...nodeOptions,
      scope: createScope(),
    })

    createRuntimeViewSchemas(node)

    expect(node.viewSchemas?.value).toHaveLength(1)
    expect(node.viewSchemas?.value[0]?.key).toBe("field:name")
    expect(node.viewSchemas?.value[0]).not.toHaveProperty("dependencies")
  })

  it("field viewSchemas 跟随 effectiveSchema computed 更新", () => {
    const nodeOptions = createFieldNodeOptions({ label: "姓名", visible: true })

    const node = createFieldNode({
      id: 1,
      ...nodeOptions,
      scope: createScope(),
    })

    createRuntimeViewSchemas(node)

    expect(node.viewSchemas?.value[0]?.visible).toBe(true)

    setFieldDynamicOverrides(
      node,
      { visible: false },
      { source: "dependencies", triggerFields: ["name" as never] }
    )

    expect(node.viewSchemas?.value[0]?.visible).toBe(false)
  })

  it("field viewSchemas 保留 componentProps 原始引用和原型", () => {
    const componentProps = Object.assign(Object.create({ inherited: true }), {
      "data-test": "field",
    })

    const nodeOptions = createFieldNodeOptions({
      componentProps: componentProps as never,
    })

    const node = createFieldNode({
      id: 1,
      ...nodeOptions,
      scope: createScope(),
    })

    createRuntimeViewSchemas(node)

    const viewSchema = node.viewSchemas?.value[0]

    if (!viewSchema || !isSchemxViewFieldSchema(viewSchema)) {
      throw new Error("field ViewSchema 未创建")
    }

    const viewProps = viewSchema.componentProps

    expect(viewProps).toBe(componentProps)
    expect(Object.getPrototypeOf(viewProps)).toBe(Object.getPrototypeOf(componentProps))
  })

  it("为 group 创建并注册 group viewSchemas", () => {
    const nodeOptions = createGroupNodeOptions()

    const node = createGroupNode({
      id: 1,
      ...nodeOptions,
      scope: createScope(),
    })

    createRuntimeViewSchemas(node)

    expect(node.viewSchemas?.value).toHaveLength(1)
    expect(node.viewSchemas?.value[0]?.key).toBe("group:0")
    expect(node.viewSchemas?.value[0]?.debug).toBeUndefined()
  })

  it("debug 模式为 group view 附加调试元数据", () => {
    const node = createGroupNode({
      id: 1,
      ...createGroupNodeOptions(),
      scope: createScope(),
    })

    createRuntimeViewSchemas(node, true)

    expect(node.viewSchemas?.value[0]?.debug).toMatchObject({
      runtimeNodeId: 1,
      runtimeNodeType: "group",
    })
  })

  it("group 和 dependency viewSchemas 透明组合 children", () => {
    const nodeManager = createNodeManager()

    const root = nodeManager.getRoot()

    const group = createGroupNode({
      id: 1,
      ...createGroupNodeOptions(),
      scope: createScope(),
    })

    const dependency = createDependencyNode({
      id: 2,
      ...createDependencyNodeOptions(),
      scope: createScope(),
    })

    const field = createFieldNode({
      id: 3,
      ...createFieldNodeOptions(),
      scope: createScope(),
    })

    createRootRuntimeViewSchemas(root)
    createRuntimeViewSchemas(group)
    createRuntimeViewSchemas(dependency)

    createRuntimeViewSchemas(field)

    nodeManager.insert(group, root.id)
    nodeManager.insert(dependency, group.id)
    nodeManager.insert(field, dependency.id)

    expect(root.viewSchemas?.value.map((schema) => schema.key)).toEqual(["group:0"])
    expect(group.viewSchemas?.value[0]).toMatchObject({
      children: [{ key: "field:name" }],
    })
  })

  it("清理节点 viewSchemas", () => {
    const node = createFieldNode({
      id: 1,
      ...createFieldNodeOptions(),
      scope: createScope(),
    })

    node.viewSchemas = {} as never

    clearRuntimeViewSchemas(node)

    expect(node.viewSchemas).toBeNull()
  })
})

function createFieldNodeOptions(overrides: Partial<SchemxResolvedBaseField> = {}) {
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
  } as SchemxBaseField

  return {
    key: "field:name",
    configToken: Symbol("field:name"),
    name: "name",
    staticSchema,
  }
}

function createGroupNodeOptions() {
  return {
    key: "group:0",
    configToken: Symbol("group:0"),
    staticSchema: {
      label: "分组",
      children: [],
      visible: true,
      readonly: false,
      disabled: false,
    } as never,
  }
}

function createDependencyNodeOptions() {
  return {
    key: "dependency:0",
    configToken: Symbol("dependency:0"),
    staticSchema: {
      to: ["type"],
      renderer: () => [],
    } as SchemxDependencyField,
  }
}
