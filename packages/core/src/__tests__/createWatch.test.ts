/**
 * createWatch 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 createWatchField / createWatchFields / createWatchAll
 * 的正确性属性。每个属性测试至少运行 100 次迭代。
 *
 * 回调签名：
 * - createWatchField:  (latestSnapshot, payload: { value, prevValue }) => void
 * - createWatchFields: (latestSnapshot, payload: { changedPaths, changedValues, prevValues }) => void
 * - createWatchAll:    (latestSnapshot, payload: { changedPaths, changedValues, prevValues }) => void
 *
 * @module core/__tests__/createWatch
 */

import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { createForm } from "../createForm"
import { createWatchAll, createWatchField, createWatchFields } from "../createWatch"

const fieldNameArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-zA-Z]\w*$/.test(s))

const safeValueArb = fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null))

// 属性测试：验证 createWatchField/createWatchFields/createWatchAll 的回调载荷、immediate、inequality、dispose 行为
describe("createWatch 属性测试", () => {
  it("createWatchAll 应持续监听任意字段变化", () => {
    const form = createForm({ initialValues: { name: "Alice", age: 18 } })

    const changes: string[][] = []

    const dispose = createWatchAll(
      form,
      (_snapshot, { changedPaths }) => {
        changes.push(changedPaths as string[])
      },
      {}
    )

    form.setFieldValue("name", "Bob")
    form.setFieldValue("age", 20)

    expect(changes).toEqual([["name"], ["age"]])
    dispose()
    form.destroy()
  })

  it("createWatchAll 回调接收本轮完整值快照", () => {
    const form = createForm({ initialValues: { name: "Alice", age: 18 } })

    let snapshot: { name: string; age: number } | undefined

    const dispose = createWatchAll(
      form,
      (values) => {
        snapshot = values
      },
      {}
    )

    form.setFieldValue("name", "Bob")

    expect(snapshot).toEqual({ name: "Bob", age: 18 })
    dispose()
    form.destroy()
  })

  it("watch 回调读取全表值不会扩大字段监听范围", () => {
    const form = createForm<{ province?: string; city?: string }>({
      initialValues: { province: undefined, city: undefined },
    })

    let callCount = 0

    const dispose = createWatchFields(
      form,
      ["province"],
      () => {
        callCount++
        form.getFieldsValue()
      },
      {}
    )

    form.setFieldValue("province", "guangdong")
    form.setFieldValue("city", "shenzhen")

    expect(callCount).toBe(1)
    dispose()
    form.destroy()
  })

  it("Property 11: createWatchField 回调接收 { value, prevValue } 载荷", () => {
    fc.assert(
      fc.property(
        fieldNameArb,
        safeValueArb,
        safeValueArb,
        (fieldName, initialValue, newValueRaw) => {
          const newValue =
            JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
              ? "___different___"
              : newValueRaw

          const form = createForm({
            initialValues: { [fieldName]: initialValue } as any,
          })

          let receivedPayload: any = undefined

          let callCount = 0

          createWatchField(
            form,
            fieldName,
            (_snapshot, payload) => {
              receivedPayload = payload
              callCount++
            },
            {}
          )

          form.setFieldValue(fieldName, newValue)

          expect(callCount).toBe(1)
          expect(receivedPayload.value).toEqual(newValue)
          expect(receivedPayload.prevValue).toEqual(initialValue)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("Property 12: createWatchFields 回调接收 { changedPaths, changedValues, prevValues } 载荷", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fieldNameArb, { minLength: 1, maxLength: 5 }),
        safeValueArb,
        safeValueArb,
        (fieldNames, initialValue, newValueRaw) => {
          const newValue =
            JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
              ? "___different___"
              : newValueRaw

          const initialValues: Record<string, any> = {}

          for (const name of fieldNames) {
            initialValues[name] = initialValue
          }

          const form = createForm({
            initialValues: initialValues as any,
          })

          let receivedPayload: any = undefined

          let receivedSnapshot: any = undefined

          let callCount = 0

          createWatchFields(
            form,
            fieldNames,
            (latestSnapshot, payload) => {
              receivedPayload = payload
              receivedSnapshot = latestSnapshot
              callCount++
            },
            {}
          )

          const targetField = fieldNames[0]

          form.setFieldValue(targetField, newValue)

          expect(callCount).toBe(1)
          expect(receivedPayload.changedValues[targetField]).toEqual(newValue)
          expect(receivedPayload.prevValues[targetField]).toEqual(initialValue)
          expect(receivedSnapshot[targetField]).toEqual(newValue)

          form.destroy()
        }
      ),
      { numRuns: 100 }
    )
  })

  // 验证 immediate: true 时 createWatchField/createWatchFields/createWatchAll 立即执行回调
  describe("Property 14: immediate 选项触发初始回调", () => {
    it("createWatchField: immediate: true 时立即执行一次回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, initialValue) => {
          const form = createForm({
            initialValues: { [fieldName]: initialValue } as any,
          })

          let callCount = 0

          let receivedPayload: any = undefined

          createWatchField(
            form,
            fieldName,
            (_snapshot, payload) => {
              callCount++
              receivedPayload = payload
            },
            { immediate: true }
          )

          expect(callCount).toBe(1)
          expect(receivedPayload.value).toEqual(initialValue)
          expect(receivedPayload.prevValue).toBeUndefined()

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })

    it("createWatchFields: immediate: true 时立即执行一次回调", () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fieldNameArb, { minLength: 1, maxLength: 5 }),
          safeValueArb,
          (fieldNames, initialValue) => {
            const initialValues: Record<string, any> = {}

            for (const name of fieldNames) {
              initialValues[name] = initialValue
            }

            const form = createForm({
              initialValues: initialValues as any,
            })

            let callCount = 0

            let receivedPayload: any = undefined

            createWatchFields(
              form,
              fieldNames,
              (_snapshot, payload) => {
                callCount++
                receivedPayload = payload
              },
              { immediate: true }
            )

            expect(callCount).toBe(1)
            expect(receivedPayload.changedValues).toBeDefined()
            for (const name of fieldNames) {
              expect(receivedPayload.changedValues[name]).toEqual(initialValue)
            }

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("createWatchAll: immediate: true 时立即执行一次回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, initialValue) => {
          const form = createForm({
            initialValues: { [fieldName]: initialValue } as any,
          })

          let callCount = 0

          let receivedSnapshot: any = undefined

          createWatchAll(
            form,
            (latestSnapshot, _payload) => {
              callCount++
              receivedSnapshot = latestSnapshot
            },
            { immediate: true }
          )

          expect(callCount).toBe(1)
          expect(receivedSnapshot).toBeDefined()
          expect(receivedSnapshot[fieldName]).toEqual(initialValue)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })
  })

  // 验证 inequality: true 时新旧值深度相等不触发回调
  describe("Property 15: inequality 选项跳过相等值", () => {
    it("createWatchField: inequality: true 且新旧值深度相等时不触发回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, value) => {
          const form = createForm({
            initialValues: { [fieldName]: value } as any,
          })

          let callCount = 0

          createWatchField(
            form,
            fieldName,
            () => {
              callCount++
            },
            { inequality: true }
          )

          form.setFieldValue(fieldName, JSON.parse(JSON.stringify(value)))
          expect(callCount).toBe(0)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })

    it("createWatchFields: inequality: true 且新旧值深度相等时不触发回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, value) => {
          const form = createForm({
            initialValues: { [fieldName]: value } as any,
          })

          let callCount = 0

          createWatchFields(
            form,
            [fieldName],
            () => {
              callCount++
            },
            { inequality: true }
          )

          form.setFieldValue(fieldName, JSON.parse(JSON.stringify(value)))
          expect(callCount).toBe(0)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })

    it("createWatchAll: inequality: true 且新旧值深度相等时不触发回调", () => {
      fc.assert(
        fc.property(fieldNameArb, safeValueArb, (fieldName, value) => {
          const form = createForm({
            initialValues: { [fieldName]: value } as any,
          })

          let callCount = 0

          createWatchAll(
            form,
            () => {
              callCount++
            },
            { inequality: true }
          )

          form.setFieldValue(fieldName, JSON.parse(JSON.stringify(value)))
          expect(callCount).toBe(0)

          form.destroy()
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 16: dispose 停止后续回调", () => {
    it("createWatchField: dispose 后不触发回调", () => {
      fc.assert(
        fc.property(
          fieldNameArb,
          safeValueArb,
          safeValueArb,
          (fieldName, initialValue, newValueRaw) => {
            const newValue =
              JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
                ? "___different___"
                : newValueRaw

            const form = createForm({
              initialValues: { [fieldName]: initialValue } as any,
            })

            let callCount = 0

            const dispose = createWatchField(
              form,
              fieldName,
              () => {
                callCount++
              },
              {}
            )

            dispose()
            form.setFieldValue(fieldName, newValue)
            expect(callCount).toBe(0)

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("createWatchFields: dispose 后不触发回调", () => {
      fc.assert(
        fc.property(
          fieldNameArb,
          safeValueArb,
          safeValueArb,
          (fieldName, initialValue, newValueRaw) => {
            const newValue =
              JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
                ? "___different___"
                : newValueRaw

            const form = createForm({
              initialValues: { [fieldName]: initialValue } as any,
            })

            let callCount = 0

            const dispose = createWatchFields(
              form,
              [fieldName],
              () => {
                callCount++
              },
              {}
            )

            dispose()
            form.setFieldValue(fieldName, newValue)
            expect(callCount).toBe(0)

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("createWatchAll: dispose 后不触发回调", () => {
      fc.assert(
        fc.property(
          fieldNameArb,
          safeValueArb,
          safeValueArb,
          (fieldName, initialValue, newValueRaw) => {
            const newValue =
              JSON.stringify(initialValue) === JSON.stringify(newValueRaw)
                ? "___different___"
                : newValueRaw

            const form = createForm({
              initialValues: { [fieldName]: initialValue } as any,
            })

            let callCount = 0

            const dispose = createWatchAll(
              form,
              () => {
                callCount++
              },
              {}
            )

            dispose()
            form.setFieldValue(fieldName, newValue)
            expect(callCount).toBe(0)

            form.destroy()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

describe("createWatch 空值与特殊对象回归", () => {
  it("清空数组、清空对象和修改 Date 都报告变化路径", () => {
    const changes: string[][] = []

    const form = createForm({
      initialValues: {
        users: ["Ada"],
        profile: { name: "Ada" },
        date: new Date("2020-01-01"),
      },
    })

    const dispose = createWatchAll(
      form,
      (_values, payload) => {
        changes.push(payload.changedPaths as string[])
      },
      {}
    )

    form.setFieldValue("users", [])
    form.setFieldValue("profile", {} as never)
    form.setFieldValue("date", new Date("2026-01-01"))

    expect(changes).toEqual([["users"], ["profile"], ["date"]])
    dispose()
    form.destroy()
  })
})
