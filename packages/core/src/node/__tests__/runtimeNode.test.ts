/**
 * RuntimeNode 创建时的初始状态测试。
 *
 * 覆盖 root/field/dependency 节点的 childNodes、descriptor、fieldState、
 * effectState 等字段的初始值。
 *
 * @module core/node/__tests__/runtimeNode.test
 */

import { describe, expect, it } from "vitest"

import {
  createTestDependencyRuntimeNode,
  createTestFieldRuntimeNode,
  createTestRootRuntimeNode,
} from "./runtimeNodeTestUtils"

import type { DependencyDescriptor, FieldDescriptor } from "../../descriptor"

function createFieldDescriptor(key: string): FieldDescriptor {
  return {
    type: "field",
    key,
    name: key,
    componentType: "input",
    staticSchema: {
      name: key,
      componentType: "input",
      visible: true,
      readonly: false,
      disabled: false,
      required: false,
      placeholder: "",
      componentProps: {},
    },
  }
}

function createDependencyDescriptor(key: string): DependencyDescriptor {
  return {
    type: "dependency",
    key,
    triggerFields: [key],
    renderer: () => [],
  }
}

// 各种 RuntimeNode 创建时的初始状态验证
describe("node child helpers", () => {
  it("应该读写 root.childNodes", () => {
    const root = createTestRootRuntimeNode()
    const field = createTestFieldRuntimeNode({
      key: "name",
      parent: root,
      descriptor: createFieldDescriptor("name"),
    })

    root.childNodes.value = [field]

    expect(root.childNodes.value).toEqual([field])
    expect(root.childNodes.value).toEqual([field])
  })

  it("described RuntimeNode 创建时 descriptor 为空", () => {
    const root = createTestRootRuntimeNode()
    const field = createTestFieldRuntimeNode({
      key: "name",
      parent: root,
      descriptor: createFieldDescriptor("name"),
    })

    expect(field.descriptor).toBeNull()
    expect(field.descriptor ?? undefined).toBeUndefined()
    expect(() => {
      if (!field.descriptor)
        throw new Error('[schemx] descriptor is required for node "name"')
    }).toThrow('[schemx] descriptor is required for node "name"')
    expect(field.fieldState).toBeNull()
    expect(field.viewState).toBeNull()
    expect(field.effectDispose).toBeNull()
    expect(field).not.toHaveProperty("fieldResourceScope")
    expect(field).not.toHaveProperty("fieldDependenciesScope")
  })

  it("DependencyRuntimeNode 创建时 dependency effect 为空", () => {
    const root = createTestRootRuntimeNode()
    const dependency = createTestDependencyRuntimeNode({
      key: "mode",
      parent: root,
      descriptor: createDependencyDescriptor("mode"),
    })

    expect(dependency.effectState).toBeNull()
    expect(dependency.dependencyDispose).toBeNull()
  })
})
