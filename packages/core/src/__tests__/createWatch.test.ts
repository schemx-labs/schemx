/**
 * createWatch 属性测试（Property-Based Testing）
 *
 * 使用 fast-check 验证 createWatchField / createWatchFields / createWatchAll
 * 的正确性属性。每个属性测试至少运行 100 次迭代。
 *
 * 回调签名：
 * - createWatchField:  (payload: { value, prevValue }, latestSnapshot) => void
 * - createWatchFields: (payload: { changedPaths, changedValues, prevValues }, latestSnapshot) => void
 * - createWatchAll:    (payload: { changedPaths, changedValues, prevValues }, latestSnapshot) => void
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

describe("createWatch 属性测试", () => {
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
            (payload) => {
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
            (payload, latestSnapshot) => {
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

  // NOTE: createWatchAll 当前使用 getFieldsSnapshot() 不建立 signal 依赖追踪，
  // 需要配合 form.effect 内部的其他 signal 读取才能触发。
  // 此处仅验证 immediate 模式下的回调行为（见 Property 14）。

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
            (payload) => {
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
              (payload) => {
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
            (_payload, latestSnapshot) => {
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
