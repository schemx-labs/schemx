/**
 * subscribeViewSchemas 订阅机制单元测试。
 *
 * @module core/view/__tests__/subscribeViewSchemas.test
 */

import { describe, expect, it, vi } from "vitest"

import { createFieldModel } from "../../field/model"
import {
  createTestFieldRuntimeNode,
  createTestRootRuntimeNode,
} from "../../node/__tests__/runtimeNodeTestUtils"
import { subscribeViewSchemas } from "../subscribeViewSchemas"
import { createViewRevision } from "../viewRevision"

import type { FieldDescriptor } from "../../descriptor/descriptor"
import type { ContainerRuntimeNode } from "../../node/runtimeNode"

const createFieldRuntimeNode = (
  parent: ContainerRuntimeNode,
  key: string,
  name: string[]
) => {
  const descriptor: FieldDescriptor = {
    type: "field",
    key,
    schema: {
      name,
      componentType: "input",
      visible: true,
      readonly: false,
      disabled: false,
      required: false,
      placeholder: "",
      componentProps: {},
    },
  }

  const node = createTestFieldRuntimeNode({ key, parent, descriptor })
  node.fieldModel = createFieldModel(descriptor)

  return node
}

describe("subscribeViewSchemas", () => {
  it("应该返回取消订阅函数并立即回调", () => {
    const root = createTestRootRuntimeNode()
    const revision = createViewRevision()
    const onChange = vi.fn()

    const unsubscribe = subscribeViewSchemas(root, revision, onChange)

    expect(typeof unsubscribe).toBe("function")
    expect(onChange).toHaveBeenCalledWith([])

    unsubscribe()
  })

  it("应该在有字段时立即回调包含字段的 ViewSchemas", () => {
    const root = createTestRootRuntimeNode()
    root.childNodes = [createFieldRuntimeNode(root, "f1", ["f1"])]
    const revision = createViewRevision()
    const onChange = vi.fn()

    subscribeViewSchemas(root, revision, onChange)

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: "f1", componentType: "input" }),
    ])
  })

  it("FieldModel 呈现态变化后应重新回调最新 ViewSchemas", () => {
    vi.useFakeTimers()

    const root = createTestRootRuntimeNode()
    const field = createFieldRuntimeNode(root, "f1", ["f1"])
    root.childNodes = [field]
    const revision = createViewRevision()
    const onChange = vi.fn()

    subscribeViewSchemas(root, revision, onChange)
    const model = field.fieldModel
    if (!model) {
      throw new Error("fieldModel should be initialized")
    }

    model.snapshot.value = {
      ...model.snapshot.peek(),
      visible: false,
    }
    vi.advanceTimersByTime(16)

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ key: "f1", visible: false }),
    ])

    vi.useRealTimers()
  })

  it("取消订阅后 revision 变化不再回调", () => {
    const root = createTestRootRuntimeNode()
    const revision = createViewRevision()
    const onChange = vi.fn()

    const unsubscribe = subscribeViewSchemas(root, revision, onChange)
    const callCountAfterFirst = onChange.mock.calls.length

    unsubscribe()
    revision.bump()

    expect(onChange).toHaveBeenCalledTimes(callCountAfterFirst)
  })

  it("onChange 回调抛出错误不应中断订阅", () => {
    const root = createTestRootRuntimeNode()
    const revision = createViewRevision()
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const onChange = vi.fn(() => {
      throw new Error("onChange error")
    })

    expect(() => {
      subscribeViewSchemas(root, revision, onChange)
    }).not.toThrow()

    errorSpy.mockRestore()
  })

  it("root dispose 后应回调空 ViewSchemas", () => {
    vi.useFakeTimers()

    const root = createTestRootRuntimeNode()
    root.childNodes = [createFieldRuntimeNode(root, "f1", ["f1"])]
    const revision = createViewRevision()
    const onChange = vi.fn()

    subscribeViewSchemas(root, revision, onChange)
    root.scope.dispose()
    revision.bump()
    vi.advanceTimersByTime(16)

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    expect(lastCall[0]).toEqual([])

    vi.useRealTimers()
  })
})
