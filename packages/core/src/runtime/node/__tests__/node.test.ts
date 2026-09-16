import { describe, expect, it } from "vitest"

import { createNodeManager } from "../nodeManager"

import {
  createTestDependencyNode,
  createTestFieldNode,
  createTestRootNode,
} from "./nodeTestUtils"

const createFieldNodeOptions = (key: string) => ({
  key,
  configToken: Symbol(key),
  name: key,
  compiledSchema: {
    name: key,
    label: key,
    componentType: "input",
  },
})

const createDependencyNodeOptions = (key: string) => ({
  key,
  configToken: Symbol(key),
  compiledSchema: {
    to: [key],
    renderer: () => [],
  },
})

describe("node child helpers", () => {
  it("应该读写 root.childNodes", () => {
    const manager = createNodeManager()

    const root = manager.getRoot()

    const field = createTestFieldNode({
      node: createFieldNodeOptions("name"),
      parent: root,
    })

    manager.insert(field, root.id)

    expect(root.childNodes.value).toEqual([field])
  })

  it("SchemaNode 创建时直接持有已解析配置", () => {
    const root = createTestRootNode()

    const field = createTestFieldNode({
      node: createFieldNodeOptions("name"),
      parent: root,
    })

    expect(field.name.value).toBe("name")
    expect(field.compiledSchema.value.componentType).toBe("input")
    expect(field.viewSchemas).toBeNull()
    expect(field.validationEffectScope).toBeNull()
  })

  it("DependencyNode 创建时 dependency effect 为空", () => {
    const root = createTestRootNode()

    const dependency = createTestDependencyNode({
      node: createDependencyNodeOptions("mode"),
      parent: root,
    })

    expect(dependency.compiledSchema.value.to).toEqual(["mode"])
    expect(dependency.rendererEffect).toBeNull()
  })
})
