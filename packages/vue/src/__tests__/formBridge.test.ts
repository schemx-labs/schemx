/**
 * Vue Form Runtime 与 Instance 测试。
 *
 * @module vue/__tests__/formBridge
 */

import { effectScope, nextTick, watchEffect } from "vue"

import { createForm } from "@schemx/core"
import { describe, expect, it, vi } from "vite-plus/test"

import { acquireVueFormRuntime } from "../bridge"
import { useForm } from "../hooks"

import type { SchemxApi } from "@schemx/core"

describe("Vue Form Instance", () => {
  it("保留 owner 时不预订阅聚合状态，首次读取后共用同一状态引用", () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    // 订阅数量反映实际启用的状态，不应由 Runtime 创建动作提前增加。
    const values = vi.spyOn(coreForm.state.values, "subscribe")

    const touched = vi.spyOn(coreForm.state.touchedFields, "subscribe")

    const pending = vi.spyOn(coreForm.state.pendingFields, "subscribe")

    const loading = vi.spyOn(coreForm.state.loading, "subscribe")

    const first = acquireVueFormRuntime(coreForm)

    const second = acquireVueFormRuntime(coreForm)

    expect(values).not.toHaveBeenCalled()
    expect(touched).not.toHaveBeenCalled()
    expect(pending).not.toHaveBeenCalled()
    expect(loading).not.toHaveBeenCalled()

    first.runtime.instance.getFieldsValue()
    first.runtime.instance.isLoading()

    const state = first.runtime.getValuesRef()

    expect(second.runtime.getValuesRef()).toBe(state)
    expect(values).toHaveBeenCalledOnce()
    expect(loading).toHaveBeenCalledOnce()
    expect(touched).not.toHaveBeenCalled()
    expect(pending).not.toHaveBeenCalled()

    first.release()
    coreForm.setFieldValue("name", "Grace")
    expect(state.value.name).toBe("Grace")

    second.release()
    coreForm.setFieldValue("name", "Lin")
    expect(state.value.name).toBe("Grace")

    coreForm.destroy()
  })

  it("读取字段值只订阅值状态，完整字段投影继续复用已有订阅", () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    // 单属性读取与完整字段投影应共享原生状态，而非提前订阅其他属性。
    const field = coreForm.state.field("name")

    const value = vi.spyOn(field.value, "subscribe")

    const errors = vi.spyOn(field.errors, "subscribe")

    const touched = vi.spyOn(field.touched, "subscribe")

    const pending = vi.spyOn(field.pending, "subscribe")

    const acquired = acquireVueFormRuntime(coreForm)

    expect(acquired.runtime.instance.getFieldValue("name")).toBe("Ada")
    expect(acquired.runtime.instance.getFieldValue("name")).toBe("Ada")
    expect(value).toHaveBeenCalledOnce()
    expect(errors).not.toHaveBeenCalled()
    expect(touched).not.toHaveBeenCalled()
    expect(pending).not.toHaveBeenCalled()

    const projected = acquired.runtime.getFieldState("name")

    expect(value).toHaveBeenCalledOnce()
    expect(errors).toHaveBeenCalledOnce()
    expect(touched).toHaveBeenCalledOnce()
    expect(pending).toHaveBeenCalledOnce()

    coreForm.setFieldValue("name", "Grace")
    expect(projected.value.value).toBe("Grace")

    acquired.release()
    coreForm.destroy()
  })

  it("useForm 在验证 scope 之前不会创建 Core 实例", () => {
    const created = vi.fn()

    const creator: SchemxApi["createForm"] = (options) => {
      created()

      return createForm(options)
    }

    expect(() => useForm({}, creator)).toThrow("requires an active Vue scope")
    expect(created).not.toHaveBeenCalled()
  })

  it("创建过程中 scope 已停止时销毁 Core 实例", () => {
    const scope = effectScope()

    const destroyed = vi.fn()

    const creator: SchemxApi["createForm"] = (options) => {
      const instance = createForm(options)

      const destroy = instance.destroy

      instance.destroy = () => {
        destroyed()
        destroy()
      }

      scope.stop()

      return instance
    }

    expect(() => scope.run(() => useForm({}, creator))).toThrow(
      "scope was stopped during form creation"
    )
    expect(destroyed).toHaveBeenCalledOnce()
  })

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

    const formInstance = acquired.runtime.instance

    acquired.release()

    formInstance.setFieldValue("name", "Grace")
    formInstance.setFieldErrors("name", ["无效名称"])
    formInstance.setFieldTouched("name", true)
    formInstance.setFieldPending("name", true, "保存中")
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

    const formInstance = acquired.runtime.instance

    acquired.release()

    formInstance.setFieldValue("age", 21)
    await nextTick()

    expect(allValuesReads).toBe(2)

    formInstance.setFieldTouched("name", true)
    formInstance.setFieldPending("name", true, "保存中")
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

    const formInstance = acquired.runtime.instance

    acquired.release()

    formInstance.setFieldValue("age", 21)
    await nextTick()

    expect(selectedFieldReads).toBe(1)
    expect(snapshotReads).toBe(1)

    formInstance.setFieldValue("name", "Grace")
    await nextTick()

    expect(selectedFieldReads).toBe(2)
    expect(snapshotReads).toBe(1)

    scope.stop()
  })

  it("Instance 手动 destroy 后停止同步 Vue Runtime", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    const effect = vi.spyOn(coreForm, "effect")

    // Instance 仍负责避免重复调用 Core destroy。
    const destroy = vi.spyOn(coreForm, "destroy")

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
    form.destroy()
    const effectCallsAfterDestroy = effect.mock.calls.length

    coreForm.setFieldValue("name", "Lin")
    form.getFieldValue("name")
    form.getFieldErrors("name")
    form.isFieldTouched("name")
    form.isFieldPending("name")
    form.getFieldsValue()
    form.getFieldsValue(["name"])
    form.getTouchedFields()
    form.getPendingFields()
    form.isLoading()
    await nextTick()

    expect(values).toEqual(["Ada", "Grace"])
    expect(effect).toHaveBeenCalledTimes(effectCallsAfterDestroy)
    expect(destroy).toHaveBeenCalledOnce()

    acquired.release()
    scope.stop()
  })
})
