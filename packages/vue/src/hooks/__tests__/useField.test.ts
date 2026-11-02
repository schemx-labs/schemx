/**
 * useField 与共享 Vue Field Bridge 测试。
 *
 * @module hooks/__tests__/useField
 */

import { defineComponent, h, nextTick, shallowRef, watchEffect } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vite-plus/test"

import { createFieldHook, useField } from ".."
import { acquireVueFormRuntime } from "../../bridge"
import { createFormContext } from "../../context"

import type { VueFormRuntime } from "../../bridge"
import type { FieldInstance, FieldPathSource } from "../../types"
import type { NamePath, SchemxInstance, Values } from "@schemx/core"

// 内存中的字段 owner，直接复用真实 Runtime 的资源释放流程。
interface FieldHarness<TValues extends Values, TName extends NamePath<TValues>> {
  // 具有 Vue Ref 的字段控制器。
  field: FieldInstance<TValues, TName>
  // 同一 Core 实例共享的桥接 Runtime。
  runtime: VueFormRuntime<TValues>
  // 仅释放本次测试 owner，不销毁原始表单。
  release(this: void): void
}

/**
 * 创建一个字段的桥接 owner，便于验证身份和资源复用。
 * @param form - 测试持有的原始 Core 表单。
 * @param name - 本次首次定位的字段路径。
 */
function createFieldHarness<TValues extends Values, TName extends NamePath<TValues>>(
  form: SchemxInstance<TValues>,
  name: FieldPathSource<TName>
): FieldHarness<TValues, TName> {
  const { runtime, release } = acquireVueFormRuntime(form)

  return { runtime, release, field: createFieldHook(runtime, name) }
}

describe("useField", () => {
  it("路径 Ref 切换后状态和命令使用新路径，旧路径更新不再触发观察", async () => {
    // 路径是消费端的响应式状态，与 Schema 节点无关。
    const path = shallowRef<"name" | "nickname">("name")

    const form = createForm({ initialValues: { name: "Ada", nickname: "Grace" } })

    const { field, release } = createFieldHarness(form, path)

    const samples: unknown[] = []

    const stop = watchEffect(() =>
      samples.push([
        field.name,
        field.value.value,
        field.errors.value,
        field.dirty.value,
        field.pending.value,
      ])
    )

    form.setFieldErrors("nickname", ["昵称错误"])
    form.setFieldTouched("nickname", true)
    form.setFieldPending("nickname", true)
    path.value = "nickname"
    await nextTick()
    expect(samples.at(-1)).toEqual(["nickname", "Grace", ["昵称错误"], true, true])
    expect(field.getInitialValue()).toBe("Grace")
    expect(field.getSnapshot()).toBe("Grace")
    field.setInitialValue("Baseline")
    field.setPending(false)
    field.reset()
    expect(form.getFieldValue("nickname")).toBe("Baseline")
    expect(form.getInitialValue("nickname")).toBe("Baseline")
    expect(form.getInitialValue("name")).toBe("Ada")
    field.setRules({ required: true, message: "不能为空" })
    await field.change("")
    await expect(field.validate()).resolves.toMatchObject({ valid: false })
    expect(field.getErrors()).toEqual(["不能为空"])
    field.removeRules()
    await expect(field.validate()).resolves.toMatchObject({ valid: true })
    await nextTick()
    const count = samples.length

    form.setFieldValue("name", "Old path")
    form.setFieldErrors("name", ["旧路径错误"])
    await nextTick()
    expect(samples).toHaveLength(count)
    expect(form.getFieldValue("nickname")).toBe("")
    stop()
    release()
    form.destroy()
  })

  it("Ref 整体赋值提交到 Core，保留程序赋值语义", () => {
    const onChange = vi.fn()

    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [{ name: "name", label: "姓名", componentType: "input", onChange }],
    })

    const { field, release } = createFieldHarness(form, "name")

    field.value.value = "Grace"
    expect(form.getFieldValue("name")).toBe("Grace")
    expect(field.getValue()).toBe("Grace")
    expect(field.isTouched()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    form.setFieldValue("name", "Lin")
    expect(field.value.value).toBe("Lin")

    release()
    form.destroy()
  })

  it("固定路径不会因同 key 的 Schema 改名而改变目标", () => {
    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [{ key: "person", name: "name", label: "姓名", componentType: "input" }],
    })

    const { field, runtime, release } = createFieldHarness(form, "name")

    const fixedPath = runtime.getFieldState("name")

    form.setFieldErrors("nickname", ["昵称错误"])
    form.setFieldTouched("nickname", true)
    form.setFieldPending("nickname", true)
    form.setSchemas([
      { key: "person", name: "nickname", label: "昵称", componentType: "input" },
    ])

    expect(field.name).toBe("name")
    expect(field.value.value).toBe("Ada")
    expect(field.getValue()).toBe("Ada")
    expect(field.errors.value).toEqual([])
    expect(field.dirty.value).toBe(false)
    expect(field.pending.value).toBe(false)
    field.value.value = "Updated"
    expect(form.getFieldValue("name")).toBe("Updated")
    expect(form.getFieldValue("nickname")).toBe("A")
    expect(fixedPath.value.value).toBe("Updated")

    release()
    form.destroy()
  })

  it("动态路径由消费端更新，数组重排和替换后按当前路径操作", async () => {
    const form = createForm({
      initialValues: { users: [{ name: "Ada" }, { name: "Grace" }] },
      schemas: [
        {
          key: "users",
          name: "users",
          item: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ],
    })

    // 消费端保存当前地址，并在重排后显式更新。
    const path = shallowRef<`users.${number}.name`>("users.0.name")

    const { field, release } = createFieldHarness(form, () => path.value)

    // 路径、值和交互状态必须在同一次 Vue 更新中指向原字段。
    const samples: unknown[] = []

    const stop = watchEffect(() => {
      samples.push([
        field.name,
        field.value.value,
        field.errors.value,
        field.dirty.value,
        field.pending.value,
      ])
    })

    try {
      form.setFieldValue("users", (users) => [...(users ?? [])].reverse())
      path.value = "users.1.name"
      await nextTick()
      expect(samples).toEqual([
        ["users.0.name", "Ada", [], false, false],
        ["users.1.name", "Ada", [], false, false],
      ])
      field.value.value = "Updated"
      expect(form.getFieldValue("users.1.name")).toBe("Updated")
      expect(form.getFieldValue("users.0.name")).toBe("Grace")
      form.setFieldValue("users", [{ name: "New0" }, { name: "New1" }])
      await nextTick()
      expect(field.name).toBe("users.1.name")
      expect(field.value.value).toBe("New1")
      field.value.value = "Latest"
      expect(form.getFieldValue("users.1.name")).toBe("Latest")
      expect(form.getFieldValue("users.0.name")).toBe("New0")
    } finally {
      stop()
      release()
      form.destroy()
    }
  })

  it("固定路径在 Schema 移除和同址替换后继续使用当前数据", async () => {
    const form = createForm({
      initialValues: { name: "Ada" },
      schemas: [{ key: "old", name: "name", label: "姓名", componentType: "input" }],
    })

    const { field, release } = createFieldHarness(form, "name")

    const names: (string | undefined)[] = []

    const stop = watchEffect(() => {
      names.push(field.name)
    })

    form.setSchemas([])
    await nextTick()
    expect(field.name).toBe("name")
    expect(field.value.value).toBe("Ada")
    expect(field.errors.value).toEqual([])
    form.setSchemas([
      { key: "new", name: "name", label: "新姓名", componentType: "input" },
    ])
    form.setFieldValue("name", "Replacement")
    field.value.value = "Latest"
    expect(form.getFieldValue("name")).toBe("Latest")
    expect(field.getValue()).toBe("Latest")
    expect(names).toEqual(["name"])

    stop()
    release()
    form.destroy()
  })

  it("手动字段使用固定路径，Form 销毁不改变消费端路径", () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    const { field, release } = createFieldHarness(form, "name")

    form.setSchemas([{ name: "name", label: "姓名", componentType: "input" }])
    form.setSchemas([])
    field.value.value = "Manual"
    expect(field.name).toBe("name")
    expect(form.getFieldValue("name")).toBe("Manual")
    form.destroy()
    expect(field.name).toBe("name")
    expect(field.getValue()).toBeUndefined()
    expect(field.value.value).toBeUndefined()
    release()
  })

  it("重复获取同一字段复用 Form 订阅，释放后停止通知但显式读取仍有效", async () => {
    const form = createForm({ initialValues: { name: "Ada" } })

    // Core adapter 统一使用所属 Form 的 effect。
    const subscribe = vi.spyOn(form, "effect")

    const first = createFieldHarness(form, "name")

    expect(first.field.getValue()).toBe("Ada")

    const subscriptions = subscribe.mock.calls.length

    expect(subscriptions).toBe(1)

    const second = createFieldHarness(form, "name")

    const values: (string | undefined)[] = []

    const stop = watchEffect(() => values.push(second.field.getValue()))

    expect(subscribe).toHaveBeenCalledTimes(subscriptions)
    first.release()
    form.setFieldValue("name", "Grace")
    await nextTick()
    expect(second.field.getValue()).toBe("Grace")
    second.release()
    form.setFieldValue("name", "Lin")
    await nextTick()
    expect(values).toEqual(["Ada", "Grace"])
    expect(second.field.getValue()).toBe("Lin")
    expect(subscribe).toHaveBeenCalledTimes(subscriptions)
    stop()
    form.destroy()
  })

  it("命令与快照读取不建立 Vue 依赖，字段读取则跟随 Form 桥接", async () => {
    const form = createForm({
      initialValues: { name: "Ada", nickname: "A" },
      schemas: [{ key: "person", name: "name", label: "姓名", componentType: "input" }],
    })

    const { field, release } = createFieldHarness(form, "name")

    const command = vi.fn(() => field.setValue("written"))

    const snapshot = vi.fn(() => field.getSnapshot())

    const stopCommand = watchEffect(command)

    const stopSnapshot = watchEffect(snapshot)

    form.setSchemas([
      { key: "person", name: "nickname", label: "昵称", componentType: "input" },
    ])
    await nextTick()
    expect(command).toHaveBeenCalledTimes(1)
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(field.getValue()).toBe("written")
    stopCommand()
    stopSnapshot()
    release()
    form.destroy()
  })

  it("字段读取方法使用共享 Vue Field Bridge", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada", age: 20 } })

    const values: Array<string | number | undefined> = []

    const errors: string[][] = []

    const touched: boolean[] = []

    const pending: boolean[] = []

    let allValuesReads = 0

    let field: FieldInstance<{ name: string; age: number }> | undefined

    const Child = defineComponent({
      setup() {
        const instance = useField<{ name: string; age: number }>("name")

        field = instance

        watchEffect(() => {
          values.push(instance.getValue())
        })
        watchEffect(() => {
          errors.push([...instance.getErrors()])
        })
        watchEffect(() => {
          touched.push(instance.isTouched())
        })
        watchEffect(() => {
          pending.push(instance.isPending())
        })
        watchEffect(() => {
          instance.getValues()
          allValuesReads++
        })

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(coreForm)

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    coreForm.setFieldValue("age", 21)
    coreForm.setFieldValue("name", "Grace")
    coreForm.setFieldErrors("name", ["无效名称"])
    coreForm.setFieldTouched("name", true)
    coreForm.setFieldPending("name", true, "保存中")
    await nextTick()

    expect(field?.getValue()).toBe("Grace")
    expect(values).toEqual(["Ada", "Grace"])
    expect(errors).toEqual([[], ["无效名称"]])
    expect(touched).toEqual([false, true])
    expect(pending).toEqual([false, true])
    expect(allValuesReads).toBe(2)

    wrapper.unmount()
    coreForm.destroy()
  })

  it("Provider scope 停止后释放 Form 订阅，保留显式读取能力", async () => {
    const coreForm = createForm({ initialValues: { name: "Ada" } })

    let field: FieldInstance<{ name: string }> | undefined

    const Child = defineComponent({
      setup() {
        field = useField<{ name: string }>("name")

        return () => h("div")
      },
    })

    const Parent = defineComponent({
      setup() {
        createFormContext(coreForm)

        return () => h(Child)
      },
    })

    const wrapper = mount(Parent)

    coreForm.setFieldValue("name", "Grace")
    await nextTick()
    wrapper.unmount()

    coreForm.setFieldValue("name", "Lin")
    await nextTick()

    expect(field?.getValue()).toBe("Lin")

    coreForm.destroy()
  })
})
