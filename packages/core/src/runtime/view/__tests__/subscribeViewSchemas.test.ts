/**
 * subscribeViewSchemas 单元测试
 *
 * 覆盖 ViewSchemas 订阅的基本行为：真实 ViewSchemas 输出、dependencies 更新 visible、
 * 取消订阅、取消后不再回调、回调错误不中断订阅、root dispose 回调空 ViewSchemas。
 *
 * @module core/runtime/view/__tests__/subscribeViewSchemas
 */
import { describe, expect, it, vi } from "vitest"

import createForm from "../../../createForm"
import { createFieldRuntimeNode } from "../../node/__tests__/runtimeNodeTestUtils"
import { createNodeManager } from "../../node/nodeManager"
import { createRootRuntimeViewSchemas } from "../createViewSchemas"
import { subscribeViewSchemas } from "../subscribeViewSchemas"

import type { RootRuntimeNode } from "../../node"

function createRootWithViewSchemas(): {
  root: RootRuntimeNode
  manager: ReturnType<typeof createNodeManager>
} {
  const manager = createNodeManager()

  const root = manager.getRoot()

  createRootRuntimeViewSchemas(root)

  return { root, manager }
}

// 验证 subscribeViewSchemas 的订阅回调、取消订阅、dependencies 更新 ViewSchema、root dispose 等行为
describe("subscribeViewSchemas", () => {
  it("root viewSchemas 应输出真实 ViewSchemas", async () => {
    const form = createForm({
      schemas: [
        {
          name: "name",
          label: "姓名",
          componentType: "input",
        },
      ],
    })

    const updates: unknown[] = []

    const dispose = form.subscribeViewSchemas((schemas) => {
      updates.push(schemas)
    })

    await Promise.resolve()

    expect(form.getViewSchemas()).toHaveLength(1)
    expect(form.getViewSchemas()[0]?.key).toContain("field:")
    expect(updates.length).toBeGreaterThan(0)
    expect(updates.at(-1)).toHaveLength(1)

    dispose()
    form.destroy()
  })

  it("dependencies 更新 visible 时 ViewSchema 应读取 effectiveSchema", async () => {
    const form = createForm<{ country: string; province?: string }>({
      schemas: [
        {
          name: "country",
          label: "国家",
          componentType: "input",
        },
        {
          name: "province",
          label: "省份",
          componentType: "input",
          dependencies: {
            triggerFields: ["country"],
            visible: (values) => values.country === "CN",
          },
        },
      ],
      initialValues: {
        country: "US",
      },
    })

    await form.waitForDependencies()

    const getProvince = () =>
      form
        .getViewSchemas()
        .find((schema) => "name" in schema && schema.name === "province")

    expect(getProvince()?.visible).toBe(false)

    form.setFieldValue("country", "CN")
    await form.waitForDependencies()

    expect(getProvince()?.visible).toBe(true)

    form.destroy()
  })

  it("应该返回取消订阅函数并立即回调", async () => {
    const { root } = createRootWithViewSchemas()

    const onChange = vi.fn()

    const unsubscribe = subscribeViewSchemas(root, onChange)

    expect(typeof unsubscribe).toBe("function")
    expect(onChange).toHaveBeenCalled()

    unsubscribe()
  })

  it("取消订阅后不再回调", async () => {
    vi.useFakeTimers()
    const { root, manager } = createRootWithViewSchemas()

    const onChange = vi.fn()

    const unsubscribe = subscribeViewSchemas(root, onChange)

    const callCountAfterFirst = onChange.mock.calls.length

    unsubscribe()
    manager.insert(
      createFieldRuntimeNode({
        id: 1,
        key: "field:name",
        configToken: Symbol("field:name"),
        name: "name",
        staticSchema: {
          name: "name",
          componentType: "input",
        } as never,
      }),
      root.id
    )
    vi.advanceTimersByTime(20)

    expect(onChange).toHaveBeenCalledTimes(callCountAfterFirst)
    vi.useRealTimers()
  })

  it("onChange 回调抛出错误不应中断订阅", async () => {
    const { root } = createRootWithViewSchemas()

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const onChange = vi.fn(() => {
      throw new Error("onChange error")
    })

    expect(() => {
      subscribeViewSchemas(root, onChange)
    }).not.toThrow()

    errorSpy.mockRestore()
  })

  it("root dispose 自动释放订阅，不再调用 onChange", async () => {
    vi.useFakeTimers()
    const form = createForm({
      schemas: [
        {
          name: "f1",
          label: "测试",
          componentType: "input",
        },
      ],
    })

    const onChange = vi.fn()

    const unsubscribe = form.subscribeViewSchemas(onChange)

    await Promise.resolve()
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.some((call) => call[0].length > 0)).toBe(true)
    const callCountBeforeDestroy = onChange.mock.calls.length

    form.destroy()
    vi.advanceTimersByTime(20)

    expect(onChange).toHaveBeenCalledTimes(callCountBeforeDestroy)

    unsubscribe()
    vi.useRealTimers()
  })
})
