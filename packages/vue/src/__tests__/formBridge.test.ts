/**
 * Vue Form Runtime 与 Instance 测试。
 *
 * @module vue/__tests__/formBridge
 */

import { effectScope, nextTick, watchEffect } from "vue"

import { createForm } from "@schemx/core"
import { describe, expect, it, vi } from "vitest"

import { acquireVueFormRuntime } from "../bridge"
import { useForm } from "../hooks/useForm"

describe("Vue Form Instance", () => {
  it("useForm 返回 Vue Instance，并保持 Core API 结构兼容", () => {
    const scope = effectScope()

    const form = scope.run(() => useForm({ initialValues: { name: "Ada" } }))

    expect(form).toBeDefined()

    scope.stop()
  })

  it("Runtime 资源重建后仍复用同一个 Instance", () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    const firstAcquired = acquireVueFormRuntime(coreForm)

    const firstInstance = firstAcquired.runtime.instance

    firstAcquired.release()

    const secondAcquired = acquireVueFormRuntime(coreForm)

    expect(secondAcquired.runtime.instance).toBe(firstInstance)

    secondAcquired.release()
    coreForm.destroy()
  })

  it("最后一个 owner 释放后可重建响应式资源", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    const firstAcquired = acquireVueFormRuntime(coreForm)

    const firstState = firstAcquired.runtime.getFieldState("name")

    firstAcquired.release()

    const secondAcquired = acquireVueFormRuntime(coreForm)

    const secondState = secondAcquired.runtime.getFieldState("name")

    const values: Array<string | undefined> = []

    const scope = effectScope()

    scope.run(() => {
      watchEffect(() => {
        values.push(secondAcquired.runtime.instance.getFieldValue("name"))
      })
    })

    coreForm.setFieldValue("name", "Grace")
    await nextTick()

    expect(secondAcquired.runtime.instance).toBe(firstAcquired.runtime.instance)
    expect(secondState).not.toBe(firstState)
    expect(values).toEqual(["Ada", "Grace"])

    scope.stop()
    secondAcquired.release()
    coreForm.destroy()
  })

  it("Instance 字段和聚合读取可被 Vue effect 追踪", async () => {
    const scope = effectScope()

    const values: Array<string | undefined> = []

    const errors: string[][] = []

    const touched: boolean[] = []

    const pending: boolean[] = []

    const form = scope.run(() => {
      const instance = useForm({ initialValues: { name: "Ada" } })

      watchEffect(() => {
        values.push(instance.getFieldValue("name"))
      })
      watchEffect(() => {
        errors.push([...instance.getFieldErrors("name")])
      })
      watchEffect(() => {
        touched.push(instance.getTouchedFields().includes("name"))
      })
      watchEffect(() => {
        pending.push(instance.getPendingFields().some((entry) => entry.field === "name"))
      })

      return instance
    })

    if (!form) {
      throw new Error("Failed to create Form in Vue effect scope.")
    }

    const acquired = acquireVueFormRuntime(form)

    const coreForm = acquired.runtime.core

    acquired.release()

    coreForm.setFieldValue("name", "Grace")
    coreForm.setFieldErrors("name", ["无效名称"])
    coreForm.setFieldTouched("name", true)
    coreForm.setFieldPending("name", true, "保存中")
    await nextTick()

    expect(values).toEqual(["Ada", "Grace"])
    expect(errors).toEqual([[], ["无效名称"]])
    expect(touched).toEqual([false, true])
    expect(pending).toEqual([false, true])

    scope.stop()
  })

  it("Instance 的全表、touched 与 pending 单字段读取可被 Vue effect 追踪", async () => {
    const scope = effectScope()

    let allValuesReads = 0

    const touched: boolean[] = []

    const pending: boolean[] = []

    const form = scope.run(() => {
      const instance = useForm({ initialValues: { name: "Ada", age: 20 } })

      watchEffect(() => {
        instance.getFieldsValue()
        allValuesReads++
      })
      watchEffect(() => {
        touched.push(instance.isFieldTouched("name"))
      })
      watchEffect(() => {
        pending.push(instance.isFieldPending("name"))
      })

      return instance
    })

    if (!form) {
      throw new Error("Failed to create Form in Vue effect scope.")
    }

    const acquired = acquireVueFormRuntime(form)

    const coreForm = acquired.runtime.core

    acquired.release()

    coreForm.setFieldValue("age", 21)
    await nextTick()

    expect(allValuesReads).toBe(2)

    coreForm.setFieldTouched("name", true)
    coreForm.setFieldPending("name", true, "保存中")
    await nextTick()

    expect(touched).toEqual([false, true])
    expect(pending).toEqual([false, true])

    scope.stop()
  })

  it("指定字段读取不会依赖无关字段，而快照读取保持无依赖", async () => {
    const scope = effectScope()

    let selectedFieldReads = 0

    let snapshotReads = 0

    const form = scope.run(() => {
      const instance = useForm({ initialValues: { name: "Ada", age: 20 } })

      watchEffect(() => {
        instance.getFieldsValue(["name"])
        selectedFieldReads++
      })
      watchEffect(() => {
        instance.getFieldsSnapshot()
        snapshotReads++
      })

      return instance
    })

    if (!form) {
      throw new Error("Failed to create Form in Vue effect scope.")
    }

    const acquired = acquireVueFormRuntime(form)

    const coreForm = acquired.runtime.core

    acquired.release()

    coreForm.setFieldValue("age", 21)
    await nextTick()

    expect(selectedFieldReads).toBe(1)
    expect(snapshotReads).toBe(1)

    coreForm.setFieldValue("name", "Grace")
    await nextTick()

    expect(selectedFieldReads).toBe(2)
    expect(snapshotReads).toBe(1)

    scope.stop()
  })

  it("Instance 手动 destroy 后停止同步 Vue Runtime", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    const effect = vi.spyOn(coreForm, "effect")

    const acquired = acquireVueFormRuntime(coreForm)

    const form = acquired.runtime.instance

    const scope = effectScope()

    const values: Array<string | undefined> = []

    scope.run(() => {
      watchEffect(() => {
        values.push(form.getFieldValue("name"))
      })
    })

    coreForm.setFieldValue("name", "Grace")
    await nextTick()
    form.destroy()
    const effectCallsAfterDestroy = effect.mock.calls.length

    coreForm.setFieldValue("name", "Lin")
    form.getFieldValue("name")
    await nextTick()

    expect(values).toEqual(["Ada", "Grace"])
    expect(effect).toHaveBeenCalledTimes(effectCallsAfterDestroy)

    acquired.release()
    scope.stop()
  })
})
