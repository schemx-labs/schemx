/**
 * Vue Form Bridge 提交 loading 投影测试。
 *
 * @module vue/__tests__/formLoadingBridge
 */

import { effectScope, nextTick, watchEffect } from "vue"

import { describe, expect, it } from "vitest"

import { useForm } from "../hooks/useForm"

/**
 * 创建可由测试主动完成的 Promise。
 *
 * @returns Promise 及其完成函数。
 */
function createDeferred(): {
  promise: Promise<void>
  resolve(): void
} {
  let resolvePromise: (() => void) | undefined

  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: () => {
      resolvePromise?.()
    },
  }
}

describe("Vue Form Bridge loading", () => {
  it("programmatic submit 的 loading 可被 Vue effect 追踪", async () => {
    const deferred = createDeferred()

    const states: boolean[] = []

    const scope = effectScope()

    const form = scope.run(() => {
      const instance = useForm({
        initialValues: { name: "Ada" },
        onFinish: () => deferred.promise,
      })

      watchEffect(() => {
        states.push(instance.isLoading())
      })

      return instance
    })

    if (!form) {
      throw new Error("Failed to create Form in Vue effect scope.")
    }

    const submit = form.submit()

    await nextTick()

    expect(states).toEqual([false, true])

    deferred.resolve()
    await submit
    await nextTick()

    expect(states).toEqual([false, true, false])

    scope.stop()
  })
})
