import { describe, expect, it } from "vitest"

import {
  createTestDependencyRuntimeNode,
  createTestFieldRuntimeNode,
  createTestRootRuntimeNode,
} from "./runtimeNodeTestUtils"

const createFieldInput = (key: string) => ({
  type: "field" as const,
  key,
  configToken: Symbol(key),
  name: key,
  componentType: "input",
  staticSchema: { name: key, label: key, componentType: "input" },
  dynamicProps: null,
  validation: null,
})

const createDependencyInput = (key: string) => ({
  type: "dependency" as const,
  key,
  configToken: Symbol(key),
  triggerFields: [key],
  renderer: () => [],
  rendererIdentity: () => [],
  staticState: { visible: true, readonly: false, disabled: false },
  dynamicProps: null,
})

describe("node child helpers", () => {
  it("应该读写 root.childNodes", () => {
    const root = createTestRootRuntimeNode()

    const field = createTestFieldRuntimeNode({
      input: createFieldInput("name"),
      parent: root,
    })

    root.childNodes.value = [field]

    expect(root.childNodes.value).toEqual([field])
  })

  it("SchemaRuntimeNode 创建时直接持有已解析配置", () => {
    const root = createTestRootRuntimeNode()

    const field = createTestFieldRuntimeNode({
      input: createFieldInput("name"),
      parent: root,
    })

    expect(field.name).toBe("name")
    expect(field.staticSchema.componentType).toBe("input")
    expect(field.fieldState).toBeNull()
    expect(field.viewState).toBeNull()
    expect(field.effectDispose).toBeNull()
  })

  it("DependencyRuntimeNode 创建时 dependency effect 为空", () => {
    const root = createTestRootRuntimeNode()

    const dependency = createTestDependencyRuntimeNode({
      input: createDependencyInput("mode"),
      parent: root,
    })

    expect(dependency.triggerFields).toEqual(["mode"])
    expect(dependency.rendererEffect).toBeNull()
  })
})
