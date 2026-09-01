/**
 * createViewSchemas 单元测试。
 *
 * 覆盖 root、field、group、dependency 节点的 ViewSchema 创建、组合与清理。
 *
 * @module core/runtime/view/__tests__/createViewSchemas.test
 */

import { describe, expect, it } from "vitest"

import {
  createDependencyRuntimeNode,
  createFieldRuntimeNode,
  createGroupRuntimeNode,
  createRootRuntimeNode,
} from "../../node/__tests__/runtimeNodeTestUtils"
import { setFieldDynamicOverrides } from "../../node/__tests__/runtimeSignalsTestUtils"
import { createNodeManager } from "../../node/nodeManager"
import { createRuntimeScope } from "../../node/runtimeScope"
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
// 验证 createViewSchemas 对各类 RuntimeNode 的 ViewSchema 创建、更新与清理。
describe("createViewSchemas", () => {
  it("为 root 创建并注册 root viewSchemas", () => {
    const root = createRootRuntimeNode({ scope: createRuntimeScope() })

    createRootRuntimeViewSchemas(root)

    expect(root.viewSchemas).not.toBeNull()
  })

  it("为 field 创建并注册 field viewSchemas", () => {
    const nodeOptions = createFieldNodeOptions()

    const node = createFieldRuntimeNode({
      id: 1,
      ...nodeOptions,
      scope: createRuntimeScope(),
    })

    createRuntimeViewSchemas(node)

    expect(node.viewSchemas?.value).toHaveLength(1)
    expect(node.viewSchemas?.value[0]?.key).toBe("field:name")
    expect(node.viewSchemas?.value[0]).not.toHaveProperty("dependencies")
  })

  it("field viewSchemas 跟随 effectiveSchema computed 更新", () => {
    const nodeOptions = createFieldNodeOptions({ label: "姓名", visible: true })

    const node = createFieldRuntimeNode({
      id: 1,
      ...nodeOptions,
      scope: createRuntimeScope(),
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

    const node = createFieldRuntimeNode({
      id: 1,
      ...nodeOptions,
      scope: createRuntimeScope(),
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

    const node = createGroupRuntimeNode({
      id: 1,
      ...nodeOptions,
      scope: createRuntimeScope(),
    })

    createRuntimeViewSchemas(node)

    expect(node.viewSchemas?.value).toHaveLength(1)
    expect(node.viewSchemas?.value[0]?.key).toBe("group:0")
    expect(node.viewSchemas?.value[0]?.debug).toBeUndefined()
  })

  it("debug 模式为 group view 附加调试元数据", () => {
    const node = createGroupRuntimeNode({
      id: 1,
      ...createGroupNodeOptions(),
      scope: createRuntimeScope(),
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

    const group = createGroupRuntimeNode({
      id: 1,
      ...createGroupNodeOptions(),
      scope: createRuntimeScope(),
    })

    const dependency = createDependencyRuntimeNode({
      id: 2,
      ...createDependencyNodeOptions(),
      scope: createRuntimeScope(),
    })

    const field = createFieldRuntimeNode({
      id: 3,
      ...createFieldNodeOptions(),
      scope: createRuntimeScope(),
    })

    createRootRuntimeViewSchemas(root)
    createRuntimeViewSchemas(group)
    createRuntimeViewSchemas(dependency)

    createRuntimeViewSchemas(field)

    nodeManager.insert(group, root.id)
    nodeManager.insert(dependency, group.id)
    nodeManager.insert(field, dependency.id)

    expect(root.viewSchemas?.value.map((schema) => schema.key)).toEqual([
      "group:0",
    ])
    expect(group.viewSchemas?.value[0]).toMatchObject({
      children: [{ key: "field:name" }],
    })
  })

  it("清理节点 viewSchemas", () => {
    const node = createFieldRuntimeNode({
      id: 1,
      ...createFieldNodeOptions(),
      scope: createRuntimeScope(),
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
