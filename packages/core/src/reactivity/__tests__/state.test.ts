import { describe, expect, it, vi } from "vite-plus/test"

import { createReactiveScope, createSignal } from ".."

describe("Core 原生只读状态", () => {
  it("保持原生 computed 的惰性与共享求值，不为每个消费者重新计算", () => {
    const scope = createReactiveScope()

    const count = createSignal(1)

    const read = vi.fn(() => count.value * 2)

    const state = scope.state(read)

    expect(read).not.toHaveBeenCalled()
    expect(state.value).toBe(2)
    expect(state.peek()).toBe(2)
    const first = vi.fn()

    const second = vi.fn()

    const stopFirst = state.subscribe(first)

    const stopSecond = state.subscribe(second)

    expect(read).toHaveBeenCalledTimes(1)
    count.value = 2
    expect(read).toHaveBeenCalledTimes(2)
    expect(first).toHaveBeenLastCalledWith(4)
    expect(second).toHaveBeenLastCalledWith(4)
    stopFirst()
    stopSecond()
    count.value = 3
    expect(read).toHaveBeenCalledTimes(2)
    expect(state.peek()).toBe(6)
    expect(read).toHaveBeenCalledTimes(3)
    scope.dispose()
  })

  it("销毁生命周期停止订阅，初次回调内销毁也不会遗留 effect", () => {
    const scope = createReactiveScope()

    const count = createSignal(1)

    const state = scope.state(() => count.value)

    const listener = vi.fn(() => scope.dispose())

    const stop = state.subscribe(listener)

    count.value = 2
    stop()
    scope.dispose()
    state.subscribe(listener)()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(() => scope.state(() => count.value)).toThrow(
      "Reactive scope has been disposed"
    )
  })
})
