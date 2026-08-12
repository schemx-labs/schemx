/**
 * useFormSelector Hook 测试。
 *
 * @module hooks/__tests__/useFormSelector
 */

import { effectScope, nextTick, watch } from "vue"

import { createForm } from "@schemx/core"
import { describe, expect, it, vi } from "vitest"

import { useFormSelector } from "../useFormSelector"

describe("useFormSelector", () => {
  it("提供初始 selector 结果，并使其可被 Vue watch 捕获", async () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const scope = effectScope()

    const observed: string[] = []

    const selected = scope.run(() => {
      const result = useFormSelector(form, (values) => values.name)

      watch(result, (value) => {
        observed.push(value)
      })

      return result
    })

    expect(selected?.value).toBe("Ada")

    form.setFieldValue("name", "Grace")
    await nextTick()

    expect(selected?.value).toBe("Grace")
    expect(observed).toEqual(["Grace"])

    scope.stop()
  })

  it("字段更新会传播给依赖该字段的 selector", () => {
    const form = createForm({ initialValues: { count: 1 } })

    const scope = effectScope()

    const selected = scope.run(() => useFormSelector(form, (values) => values.count ?? 0))

    form.setFieldValue("count", 2)

    expect(selected?.value).toBe(2)

    scope.stop()
  })

  it("无关字段变化且 selector 结果相等时不通知消费者", async () => {
    const form = createForm({ initialValues: { name: "Ada", age: 30 } })

    const scope = effectScope()

    const observed = vi.fn()

    scope.run(() => {
      const selected = useFormSelector(form, (values) => values.name)

      watch(selected, observed)
    })

    form.setFieldValue("age", 31)
    await nextTick()

    expect(observed).not.toHaveBeenCalled()

    scope.stop()
  })

  it("批量写入只将最终状态暴露给 selector", async () => {
    const form = createForm({ initialValues: { firstName: "Ada", lastName: "Lovelace" } })

    const scope = effectScope()

    const observed: string[] = []

    const selected = scope.run(() => {
      const result = useFormSelector(
        form,
        (values) => `${values.firstName} ${values.lastName}`
      )

      watch(result, (value) => {
        observed.push(value)
      })

      return result
    })

    form.setFieldsValue({ firstName: "Grace", lastName: "Hopper" })
    await nextTick()

    expect(selected?.value).toBe("Grace Hopper")
    expect(observed).toEqual(["Grace Hopper"])

    scope.stop()
  })

  it("支持以自定义 equals 忽略等价结果", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const scope = effectScope()

    const equals = vi.fn((previous: string | undefined, next: string | undefined) => {
      return previous?.toLowerCase() === next?.toLowerCase()
    })

    const selected = scope.run(() => {
      return useFormSelector(form, (values) => values.name, { equals })
    })

    form.setFieldValue("name", "ADA")

    expect(equals).toHaveBeenCalledWith("Ada", "ADA")
    expect(selected?.value).toBe("Ada")

    scope.stop()
  })

  it("同一表单复用一份 Core 订阅，并在最后一个 scope 销毁后释放", () => {
    const form = createForm({ initialValues: { count: 1 } })

    const effect = vi.spyOn(form, "effect")

    const firstScope = effectScope()

    const secondScope = effectScope()

    const first = firstScope.run(() => useFormSelector(form, (values) => values.count))

    const second = secondScope.run(() => useFormSelector(form, (values) => values.count))

    // values、touched、pending 与 submit loading 各自维护一份共享 Core 订阅。
    expect(effect).toHaveBeenCalledTimes(4)

    firstScope.stop()
    form.setFieldValue("count", 2)
    expect(second?.value).toBe(2)

    secondScope.stop()
    form.setFieldValue("count", 3)

    expect(second?.value).toBe(2)
    expect(first?.value).toBe(1)
  })
})
