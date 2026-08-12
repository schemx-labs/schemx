/**
 * Vue Form Bridge 与 Facade 测试。
 *
 * @module vue/__tests__/formBridge
 */

import { effectScope, nextTick, watchEffect } from "vue"

import { createForm } from "@schemx/core"
import { describe, expect, it, vi } from "vitest"

import {
  getCoreForm,
  getVueFormBridge,
  getVueFormFacade,
  retainVueFormBridge,
} from "../formBridge"
import { useForm } from "../hooks/useForm"

describe("Vue Form Facade", () => {
  it("useForm 返回唯一 Facade，并保留原始 Core Form 访问出口", () => {
    const scope = effectScope()

    const form = scope.run(() => useForm({ initialValues: { name: "Ada" } }))

    expect(form).toBeDefined()
    expect(getCoreForm(form!)).not.toBe(form)
    expect(getCoreForm(form!)).toBe(getCoreForm(form!))

    scope.stop()
  })

  it("Bridge 重建后仍复用同一个 Facade", () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    const firstFacade = getVueFormFacade(coreForm)

    const releaseBridge = retainVueFormBridge(getVueFormBridge(coreForm))

    releaseBridge()

    expect(getVueFormFacade(coreForm)).toBe(firstFacade)

    coreForm.destroy()
  })

  it("Facade 字段和聚合读取可被 Vue effect 追踪", async () => {
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

    const coreForm = getCoreForm(form!)

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

  it("Facade 的全表、touched 与 pending 单字段读取可被 Vue effect 追踪", async () => {
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

    const coreForm = getCoreForm(form!)

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

    const coreForm = getCoreForm(form!)

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

  it("Facade 手动 destroy 后停止同步 Vue Bridge", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    const effect = vi.spyOn(coreForm, "effect")

    const form = getVueFormFacade(coreForm)

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

    scope.stop()
  })
})
