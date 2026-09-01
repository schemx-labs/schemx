import { describe, expect, it } from "vitest"

import { createNodeManager } from "../nodeManager"

import {
  createTestDependencyRuntimeNode,
  createTestFieldRuntimeNode,
  createTestRootRuntimeNode,
} from "./runtimeNodeTestUtils"

const createFieldNodeOptions = (key: string) => ({
  key,
  configToken: Symbol(key),
  name: key,
  staticSchema: {
    name: key,
    label: key,
    componentType: "input",
  },
})

const createDependencyNodeOptions = (key: string) => ({
  key,
  configToken: Symbol(key),
  staticSchema: {
    to: [key],
    renderer: () => [],
  },
})

describe("node child helpers", () => {
  it("应该读写 root.childNodes", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    const field = createTestFieldRuntimeNode({
      node: createFieldNodeOptions("name"),
      parent: root,
    })

    manager.insert(field, root.id)

    expect(root.childNodes.value).toEqual([field])
  })

  it("SchemaRuntimeNode 创建时直接持有已解析配置", () => {
    const root = createTestRootRuntimeNode()

    const field = createTestFieldRuntimeNode({
      node: createFieldNodeOptions("name"),
      parent: root,
    })

    expect(field.name.value).toBe("name")
    expect(field.staticSchema.value.componentType).toBe("input")
    expect(field.viewSchemas).toBeNull()
    expect(field.validationEffectScope).toBeNull()
  })

  it("DependencyRuntimeNode 创建时 dependency effect 为空", () => {
    const root = createTestRootRuntimeNode()

    const dependency = createTestDependencyRuntimeNode({
      node: createDependencyNodeOptions("mode"),
      parent: root,
    })

    expect(dependency.staticSchema.value.to).toEqual(["mode"])
    expect(dependency.rendererEffect).toBeNull()
  })
})
