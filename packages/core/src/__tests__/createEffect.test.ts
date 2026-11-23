/**
 * createEffect 单元测试与属性测试
 *
 * 覆盖 createEffect 的所有正确性属性和边界情况：
 * 创建后立即执行、依赖追踪、dispose 停止响应、dispose 幂等、
 * cleanup 机制、batch 协同。
 *
 * @module core/__tests__/createEffect
 */
import { batch, signal } from "@preact/signals-core"
import fc from "fast-check"
import { describe, expect, it, vi } from "vitest"

import { createEffect } from "../createEffect"

import type { CreateEffectReturn } from "../createEffect"

describe("createEffect 属性测试", () => {
  // Feature: create-effect-api, Property 1: 创建后立即执行一次回调
  // **Validates: Requirements 1.1, 1.4**
  it("Property 1: 创建后立即执行一次回调并返回 dispose 函数", () => {
    fc.assert(
      fc.property(fc.integer(), (initial) => {
        const s = signal(initial)
        let callCount = 0

        const dispose = createEffect(() => {
          void s.value
          callCount++
        })

        expect(callCount).toBe(1)
        expect(typeof dispose).toBe("function")

        dispose()
      }),
      { numRuns: 100 }
    )
  })

  // Feature: create-effect-api, Property 2: 依赖追踪与重新执行
  // **Validates: Requirements 1.2, 1.3**
  it("Property 2: 依赖追踪与重新执行", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer().filter((v) => v !== 0),
        (initial, delta) => {
          const s = signal(initial)
          let callCount = 0
          let lastSeen: number | undefined

          const dispose = createEffect(() => {
            lastSeen = s.value
            callCount++
          })

          expect(callCount).toBe(1)
          expect(lastSeen).toBe(initial)

          s.value = initial + delta
          expect(callCount).toBe(2)
          expect(lastSeen).toBe(initial + delta)

          dispose()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: create-effect-api, Property 3: dispose 后停止响应
  // **Validates: Requirements 2.1**
  it("Property 3: dispose 后停止响应", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (initial, newVal) => {
        const s = signal(initial)
        let callCount = 0

        const dispose = createEffect(() => {
          void s.value
          callCount++
        })

        expect(callCount).toBe(1)
        dispose()

        s.value = newVal
        expect(callCount).toBe(1)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: create-effect-api, Property 4: dispose 幂等性
  // **Validates: Requirements 2.2**
  it("Property 4: dispose 幂等性", () => {
    fc.assert(
      fc.property(fc.nat({ max: 10 }), (extraCalls) => {
        const s = signal(0)
        const cleanupFn = vi.fn()

        const dispose = createEffect(() => {
          void s.value

          return cleanupFn
        })

        dispose()
        const cleanupCallCount = cleanupFn.mock.calls.length

        for (let i = 0; i < extraCalls; i++) {
          expect(() => dispose()).not.toThrow()
        }

        expect(cleanupFn).toHaveBeenCalledTimes(cleanupCallCount)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: create-effect-api, Property 5: 重新执行前调用 cleanup
  // **Validates: Requirements 3.1**
  it("Property 5: 重新执行前调用 cleanup", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer().filter((v) => v !== 0),
        (initial, delta) => {
          const s = signal(initial)
          const order: string[] = []

          const dispose = createEffect(() => {
            void s.value
            order.push("effect")

            return () => {
              order.push("cleanup")
            }
          })

          expect(order).toEqual(["effect"])

          s.value = initial + delta
          expect(order).toEqual(["effect", "cleanup", "effect"])

          dispose()
        }
      ),
      { numRuns: 100 }
    )
  })

  // Feature: create-effect-api, Property 6: dispose 时调用 cleanup
  // **Validates: Requirements 3.2**
  it("Property 6: dispose 时调用 cleanup", () => {
    fc.assert(
      fc.property(fc.integer(), (initial) => {
        const s = signal(initial)
        const cleanupFn = vi.fn()

        const dispose = createEffect(() => {
          void s.value

          return cleanupFn
        })

        expect(cleanupFn).not.toHaveBeenCalled()

        dispose()
        expect(cleanupFn).toHaveBeenCalledTimes(1)
      }),
      { numRuns: 100 }
    )
  })

  // Feature: create-effect-api, Property 7: batch 合并触发且读取最新值
  // **Validates: Requirements 4.1, 4.2**
  it("Property 7: batch 合并触发且读取最新值", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(fc.integer(), fc.integer())
          .filter(([valA, valB]) => valA !== 0 || valB !== 0),
        ([valA, valB]) => {
          const a = signal(0)
          const b = signal(0)
          let callCount = 0
          let lastA: number | undefined
          let lastB: number | undefined

          const dispose = createEffect(() => {
            lastA = a.value
            lastB = b.value
            callCount++
          })

          expect(callCount).toBe(1)

          batch(() => {
            a.value = valA
            b.value = valB
          })

          expect(callCount).toBe(2)
          expect(lastA).toBe(valA)
          expect(lastB).toBe(valB)

          dispose()
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe("createEffect 单元测试", () => {
  it("回调不返回清理函数时正常工作", () => {
    const s = signal(0)
    let callCount = 0

    const dispose = createEffect(() => {
      void s.value
      callCount++
    })

    s.value = 1
    expect(callCount).toBe(2)

    dispose()

    s.value = 2
    expect(callCount).toBe(2)
  })

  it("回调返回 undefined 时不报错", () => {
    const dispose = createEffect(() => {
      return undefined
    })

    expect(() => dispose()).not.toThrow()
  })

  it("CreateEffectReturn 类型可正确赋值", () => {
    const dispose: CreateEffectReturn = createEffect(() => {})
    expect(typeof dispose).toBe("function")
    dispose()
  })

  it("与 form.getFieldValue 等方法配合使用", () => {
    // 模拟 form 内部的 ReactiveMap 行为
    const nameSignal = signal("Alice")
    let captured: string | undefined

    const dispose = createEffect(() => {
      captured = nameSignal.value
    })

    expect(captured).toBe("Alice")

    nameSignal.value = "Bob"
    expect(captured).toBe("Bob")

    dispose()

    nameSignal.value = "Charlie"
    expect(captured).toBe("Bob")
  })

  it("batch 内更新不触发 effect 时不执行 cleanup", () => {
    const a = signal(0)
    const b = signal(0)
    const cleanupCalls: number[] = []
    let callCount = 0

    const dispose = createEffect(() => {
      void a.value
      callCount++

      return () => {
        cleanupCalls.push(callCount)
      }
    })

    // b 不是依赖，更新 b 不应触发 effect
    batch(() => {
      b.value = 1
    })

    expect(callCount).toBe(1)
    expect(cleanupCalls).toEqual([])

    dispose()
  })

  it("batch 内写入相同值时不重新触发 effect", () => {
    const a = signal(0)
    const b = signal(0)
    let callCount = 0

    const dispose = createEffect(() => {
      void a.value
      void b.value
      callCount++
    })

    batch(() => {
      a.value = 0
      b.value = 0
    })

    expect(callCount).toBe(1)

    dispose()
  })
})
