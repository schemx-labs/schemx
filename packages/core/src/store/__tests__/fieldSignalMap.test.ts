/**
 * FieldSignalMap 测试。
 *
 * @module core/reactivity/__tests__/fieldSignalMap.test
 */

import { describe, expect, it, vi } from "vitest"

import { createSignalEffect } from "../../reactivity/effect"
import { createSignal } from "../../reactivity/signal"
import { createFieldSignalMap } from "../fieldSignalMap"

import type { NamePath } from "../../types"
import type { ValidationRuleIssue } from "../../validator/types"

interface TestValues {
  profile: {
    name: string
    email: string
  }
  users: Array<{
    name: string
  }>
  other: string
}

const initialValues: TestValues = {
  profile: {
    name: "Ada",
    email: "ada@example.com",
  },
  users: [{ name: "Ada" }, { name: "Grace" }],
  other: "other",
}

/**
 * 创建带有错误来源类型的测试问题。
 *
 * @param message - 面向用户的错误消息。
 * @param type - 测试问题所属的错误来源。
 * @returns 带有来源类型和测试编码的问题。
 */
const createIssue = (
  message: string,
  type: ValidationRuleIssue["type"]
): ValidationRuleIssue => ({
  type,
  message,
  code: type,
})

describe("createSignal", () => {
  it("应该支持 signals-core 的 subscribe / name / value 转换能力", () => {
    const watched = vi.fn()

    const unwatched = vi.fn()

    const count = createSignal(1, { name: "count", watched, unwatched })

    const listener = vi.fn()

    const unsubscribe = count.subscribe(listener)

    expect(count.name).toBe("count")
    expect(watched).toHaveBeenCalledTimes(1)

    count.value = 2

    expect(listener).toHaveBeenCalledWith(2)
    expect(count.peek()).toBe(2)
    expect(count.valueOf()).toBe(2)
    expect(count.toString()).toBe("2")
    expect(count.toJSON()).toBe(2)

    unsubscribe()

    expect(unwatched).toHaveBeenCalledTimes(1)
  })

  it("应该支持无初始值创建 signal", () => {
    const value = createSignal<string>()

    expect(value.value).toBeUndefined()

    value.value = "ready"

    expect(value.peek()).toBe("ready")
  })
})

describe("FieldSignalMap", () => {
  it("应该按规范化路径惰性创建状态并复用同一路径", () => {
    const map = createFieldSignalMap<TestValues>()

    const bracketPath = "users[0].name" as NamePath<TestValues>

    map.setFieldTouched(bracketPath, true)
    expect(map.isFieldTouched(bracketPath)).toBe(true)

    map.setFieldTouched("users.0.name", false)
    expect(map.isFieldTouched(bracketPath)).toBe(false)
  })

  it("反注册不会删除已注册的字段状态", () => {
    const map = createFieldSignalMap<TestValues>()

    map.registerFieldPath("profile.name")
    map.setFieldTouched("profile.name", true)
    map.unregisterFieldPath("profile.name")

    expect(map.isFieldTouched("profile.name")).toBe(true)
    expect([...map.getFieldKeys()]).toEqual(["profile.name"])
  })

  it("应该返回当前值、初始值和独立快照，并正确触发写入回调", () => {
    const onValueChanged = vi.fn()

    const onInitialValueChanged = vi.fn()

    const map = createFieldSignalMap<TestValues>({
      initialValues,
      onValueChanged,
      onInitialValueChanged,
    })

    expect(map.getFieldValue("profile.name")).toBe("Ada")
    expect(map.peekFieldValue("profile.name")).toBe("Ada")
    expect(map.getFieldInitialValue("profile.name")).toBe("Ada")
    expect(map.peekFieldInitialValue("profile.name")).toBe("Ada")

    expect(map.setFieldValue("profile.name", "Ada")).toBe(false)
    expect(onValueChanged).toHaveBeenCalledTimes(0)

    expect(map.setFieldValue("profile.name", "Grace")).toBe(true)
    expect(onValueChanged).toHaveBeenCalledTimes(1)

    const snapshot = map.getFieldSnapshot("profile")

    expect(snapshot).toEqual({
      name: "Grace",
      email: "ada@example.com",
    })

    if (snapshot === undefined) throw new Error("字段快照不应为空")

    snapshot.name = "Changed"

    expect(map.peekFieldValue("profile.name")).toBe("Grace")

    expect(map.setFieldInitialValue("profile.name", "Ada")).toBe(false)
    expect(onInitialValueChanged).toHaveBeenCalledTimes(0)

    expect(map.setFieldInitialValue("profile.name", "Grace")).toBe(true)
    expect(onInitialValueChanged).toHaveBeenCalledTimes(1)
    expect(map.getFieldInitialValue("profile.name")).toBe("Grace")
  })

  it("当前值通知只触发重叠路径", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    const runs = new Map<string, number>()

    const paths = ["profile", "profile.name", "other"] as const

    const disposes = paths.map((path) =>
      createSignalEffect(() => {
        map.getFieldValue(path)
        runs.set(path, (runs.get(path) ?? 0) + 1)
      })
    )

    map.setFieldValue("profile.name", "Grace")

    expect(runs).toEqual(
      new Map([
        ["profile", 2],
        ["profile.name", 2],
        ["other", 1],
      ])
    )

    for (const dispose of disposes) dispose()
  })

  it("删除当前值并清理字段交互状态，但保留初始值", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    map.setFieldTouched("profile.name", true)
    map.setFieldPending("profile.name", true, "保存中")
    map.removeFieldValue("profile.name")

    expect(map.getFieldValue("profile.name")).toBeUndefined()
    expect(map.getFieldInitialValue("profile.name")).toBe("Ada")
    expect(map.isFieldTouched("profile.name")).toBe(false)
    expect(map.isFieldPending("profile.name")).toBe(false)
    expect(map.getFieldPendingMessage("profile.name")).toEqual([])
    expect(map.getFieldValue("profile.email")).toBe("ada@example.com")
  })

  it("删除数组索引字段时不改变其他索引", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    map.removeFieldValue("users[0].name" as NamePath<TestValues>)

    expect(map.getFieldValue("users[0].name" as NamePath<TestValues>)).toBeUndefined()
    expect(map.getFieldValue("users[1].name" as NamePath<TestValues>)).toBe("Grace")
  })

  it("初始值通知不触发当前值依赖", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    let valueRuns = 0

    let initialRuns = 0

    const disposeValue = createSignalEffect(() => {
      valueRuns += 1
      map.getFieldValue("profile.name")
    })

    const disposeInitial = createSignalEffect(() => {
      initialRuns += 1
      map.getFieldInitialValue("profile.name")
    })

    map.setFieldInitialValue("profile.name", "Grace")

    expect(valueRuns).toBe(1)
    expect(initialRuns).toBe(2)

    disposeValue()
    disposeInitial()
  })

  it("应该支持单字段 touched/pending 设置和消息覆盖", () => {
    const map = createFieldSignalMap<TestValues>()

    map.setFieldTouched("profile.name", true)
    map.setFieldPending("profile.email", true, "保存中")

    expect(map.isFieldTouched("profile.name")).toBe(true)
    expect(map.isFieldPending("profile.email")).toBe(true)
    expect(map.getFieldPendingMessage("profile.email")).toEqual(["保存中"])

    map.setFieldPending("profile.email", true, ["校验中", "请稍候"])
    expect(map.getFieldPendingMessage("profile.email")).toEqual(["校验中", "请稍候"])
  })

  it("应该响应单字段 touched/pending 状态变化，并在清除时移除消息", () => {
    const map = createFieldSignalMap<TestValues>()

    let touchedRuns = 0

    let pendingRuns = 0

    const disposeTouched = createSignalEffect(() => {
      touchedRuns += 1
      map.isFieldTouched("profile.name")
    })

    const disposePending = createSignalEffect(() => {
      pendingRuns += 1
      map.isFieldPending("profile.email")
    })

    expect(touchedRuns).toBe(1)
    expect(pendingRuns).toBe(1)

    map.setFieldTouched("profile.name", true)

    expect(map.isFieldTouched("profile.name")).toBe(true)
    expect(touchedRuns).toBe(2)

    map.setFieldPending("profile.email", true, ["保存中"])

    expect(map.isFieldPending("profile.email")).toBe(true)
    expect(map.getFieldPendingMessage("profile.email")).toEqual(["保存中"])
    expect(pendingRuns).toBe(2)

    map.setFieldPending("profile.email", true, ["保存中"])
    expect(pendingRuns).toBe(2)

    map.setFieldPending("profile.email", false, "忽略")

    expect(map.isFieldPending("profile.email")).toBe(false)
    expect(map.getFieldPendingMessage("profile.email")).toEqual([])
    expect(pendingRuns).toBe(3)

    disposeTouched()
    disposePending()
  })

  it("应该保存错误列表并建立字段级响应式依赖", () => {
    const map = createFieldSignalMap<TestValues>()

    let runs = 0

    const dispose = createSignalEffect(() => {
      runs += 1
      map.getFieldErrors("profile.name")
    })

    expect(map.peekFieldErrors("profile.name")).toEqual([])

    map.setFieldErrors("profile.name", [
      createIssue("姓名配置错误", "configuration"),
      createIssue("姓名错误", "validation"),
      createIssue("姓名已存在", "external"),
    ])

    expect(map.getFieldErrors("profile.name")).toEqual([
      createIssue("姓名配置错误", "configuration"),
      createIssue("姓名错误", "validation"),
      createIssue("姓名已存在", "external"),
    ])
    expect(runs).toBe(2)

    map.clearAllErrors()
    expect(map.peekFieldErrors("profile.name")).toEqual([])

    dispose()
  })

  it("应该清除单字段错误并避免重复清除产生通知", () => {
    const map = createFieldSignalMap<TestValues>()

    let fieldRuns = 0

    const disposeField = createSignalEffect(() => {
      fieldRuns += 1
      map.getFieldErrors("profile.name")
    })

    map.setFieldErrors("profile.name", [createIssue("姓名错误", "validation")])

    expect(fieldRuns).toBe(2)

    map.clearFieldErrors("profile.name")

    expect(map.getFieldErrors("profile.name")).toEqual([])
    expect(fieldRuns).toBe(3)

    map.clearFieldErrors("profile.name")

    expect(fieldRuns).toBe(3)

    disposeField()
  })

  it("应该按 paths 获取多个或全部已注册字段状态", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    map.registerFieldPath("profile.name")
    map.getFieldValue("profile.email")
    map.setFieldTouched("profile.name", true)
    map.setFieldPending("profile.email", true, "保存中")
    map.setFieldErrors("profile.email", [createIssue("邮箱错误", "validation")])

    expect(
      map.getFieldStates(["profile.email", "profile.name"]).map((state) => state.path)
    ).toEqual(["profile.email", "profile.name"])
    expect([...map.getFieldKeys(["profile.name", "profile.email"])]).toEqual([
      "profile.name",
      "profile.email",
    ])
    expect([...map.getFieldValues(["profile.name"])].map((state) => state.path)).toEqual([
      "profile.name",
    ])
    expect([...map.getFieldEntries()].map(([path]) => path)).toEqual([
      "profile.name",
      "profile.email",
    ])
    expect([...map.getFieldEntries(["profile.email"])].map(([path]) => path)).toEqual([
      "profile.email",
    ])
    expect([...map.getFieldKeys()]).toEqual(["profile.name", "profile.email"])
    expect(map.getFieldStates()).toHaveLength(2)
  })

  it("数组结构变化时只清理受影响字段的 validation/external 错误", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    map.setFieldErrors("users.1.name", [
      createIssue("配置错误", "configuration"),
      createIssue("校验错误", "validation"),
      createIssue("服务端错误", "external"),
    ])
    map.setFieldErrors("users.0.name", [
      createIssue("首行配置错误", "configuration"),
      createIssue("首行错误", "validation"),
      createIssue("首行服务端错误", "external"),
    ])

    map.setFieldArrayValue("users", initialValues.users, {
      previousLength: 2,
      nextLength: 2,
      ranges: [{ start: 1, end: 1 }],
    })

    expect(map.getFieldErrors("users.0.name")).toEqual([
      createIssue("首行配置错误", "configuration"),
      createIssue("首行错误", "validation"),
      createIssue("首行服务端错误", "external"),
    ])
    expect(map.getFieldErrors("users.1.name")).toEqual([
      createIssue("配置错误", "configuration"),
    ])

    map.setFieldArrayValue("users", [initialValues.users[0]], {
      previousLength: 2,
      nextLength: 1,
      ranges: [{ start: 0, end: 1 }],
    })

    expect(map.getFieldErrors("users.0.name")).toEqual([
      createIssue("首行配置错误", "configuration"),
    ])
    expect(map.getFieldErrors("users.1.name")).toEqual([])
  })

  it("应该清理指定路径、数组范围和全部交互状态", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    map.setFieldTouched("profile.name", true)
    map.setFieldPending("profile.email", true)
    map.setFieldTouched("users.0.name", true)
    map.setFieldPending("users.1.name", true)

    map.clearFieldTransientState("profile")
    expect(map.isFieldTouched("profile.name")).toBe(false)
    expect(map.isFieldPending("profile.email")).toBe(false)

    map.setFieldArrayValue("users", [{ name: "Ada" }, { name: "Hedy" }], {
      previousLength: 2,
      nextLength: 2,
      ranges: [{ start: 1, end: 1 }],
    })

    expect(map.isFieldTouched("users.0.name")).toBe(true)
    expect(map.isFieldPending("users.1.name")).toBe(false)

    map.clearFieldTransientState("" as NamePath<TestValues>)
    expect(map.isFieldTouched("users.0.name")).toBe(false)
    expect(map.isFieldPending("users.1.name")).toBe(false)
  })

  it("数组通知只影响根、祖先和受影响索引范围", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    const runs = new Map<string, number>()

    const paths = [
      "" as NamePath<TestValues>,
      "users",
      "users.0.name",
      "users.1.name",
      "other",
    ] as const

    const disposes = paths.map((path) =>
      createSignalEffect(() => {
        map.getFieldValue(path)
        runs.set(path, (runs.get(path) ?? 0) + 1)
      })
    )

    map.setFieldArrayValue("users", [{ name: "Ada" }, { name: "Hedy" }], {
      previousLength: 2,
      nextLength: 2,
      ranges: [{ start: 1, end: 1 }],
    })

    expect(runs).toEqual(
      new Map([
        ["", 2],
        ["users", 2],
        ["users.0.name", 1],
        ["users.1.name", 2],
        ["other", 1],
      ])
    )

    for (const dispose of disposes) dispose()
  })

  it("数组结构变化即使值相同也会通知并清理状态", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    let valueRuns = 0

    const dispose = createSignalEffect(() => {
      valueRuns += 1
      map.getFieldValue("users.0.name")
    })

    map.setFieldTouched("users.0.name", true)
    map.setFieldArrayValue("users", initialValues.users, {
      previousLength: 2,
      nextLength: 2,
      ranges: [{ start: 0, end: 1 }],
      resetKeys: true,
    })

    expect(valueRuns).toBe(2)
    expect(map.isFieldTouched("users.0.name")).toBe(false)

    dispose()
  })

  it("应该销毁值树和字段状态，并支持后续按需重建", () => {
    const map = createFieldSignalMap<TestValues>({ initialValues })

    map.setFieldValue("profile.name", "Grace")
    map.setFieldTouched("profile.name", true)
    map.setFieldErrors("profile.name", [createIssue("姓名错误", "validation")])

    expect(map.getFieldStates()).toHaveLength(1)

    map.destroy()

    expect(map.getFieldStates()).toEqual([])
    expect(map.getFieldValue("profile.name")).toBeUndefined()
    expect(map.getFieldInitialValue("profile.name")).toBeUndefined()
    expect(map.isFieldTouched("profile.name")).toBe(false)
  })
})
