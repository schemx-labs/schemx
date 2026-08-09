/**
 * ReactiveMap（createSignalMap）的响应式能力测试。
 *
 * 覆盖读写、链式调用、迭代、延迟追踪、批量更新以及删除通知行为。
 *
 * @module core/reactivity/__tests__/reactiveMap.test
 */

import { describe, expect, it } from "vitest"

import { batchUpdates, createSignal, createSignalEffect, createSignalMap } from "../index"

// ReactiveMap 的基础读写、迭代、延迟追踪、批量更新和删除通知
describe("ReactiveMap", () => {
  it("reads and writes keyed values", () => {
    const map = createSignalMap<string, unknown>()

    map.set("name", "Alice")

    expect(map.get("name")).toBe("Alice")
    expect(map.peek("name")).toBe("Alice")
    expect(map.has("name")).toBe(true)
  })

  it("supports fluent set chaining", () => {
    const map = createSignalMap<string, number>()

    const returned = map.set("count", 1).set("count", 2)

    expect(returned).toBe(map)
    expect(map.get("count")).toBe(2)
  })

  it("deletes and clears values", () => {
    const map = createSignalMap<string, number>()

    map.set("a", 1)
    map.set("b", 2)
    expect(map.delete("a")).toBe(true)
    expect(map.delete("missing")).toBe(false)

    expect(map.get("a")).toBeUndefined()
    expect(map.has("a")).toBe(false)

    map.clear()

    expect(map.get("b")).toBeUndefined()
    expect([...map.keys()]).toEqual([])
  })

  it("iterates keys, values, and entries like Map", () => {
    const map = createSignalMap<string, number>()

    map.set("a", 1)
    map.set("b", 2)

    expect([...map.keys()]).toEqual(["a", "b"])
    expect([...map.values()]).toEqual([1, 2])
    expect([...map.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
    ])
  })

  it("tracks keys that are created after an effect reads them", () => {
    const map = createSignalMap<string, unknown>()

    let runs = 0

    let latest: unknown

    const dispose = createSignalEffect(() => {
      latest = map.get("late")
      runs++
    })

    expect(runs).toBe(1)
    expect(latest).toBeUndefined()

    map.set("late", "value")

    expect(runs).toBe(2)
    expect(latest).toBe("value")

    dispose()
  })

  it("batches multiple reactive writes", () => {
    const map = createSignalMap<string, number>()

    map.set("count", 0)

    let runs = 0

    let isFirst = true

    const dispose = createSignalEffect(() => {
      map.get("count")
      if (isFirst) {
        isFirst = false

        return
      }

      runs++
    })

    batchUpdates(() => {
      map.set("count", 1)
      map.set("count", 2)
    })

    expect(runs).toBe(1)

    dispose()
  })

  it("notifies subscribers when a key is deleted", () => {
    const map = createSignalMap<string, number>()

    map.set("count", 0)

    let runs = 0

    let latest: number | undefined

    const dispose = createSignalEffect(() => {
      latest = map.get("count")
      runs++
    })

    expect(runs).toBe(1)
    expect(latest).toBe(0)

    map.delete("count")

    expect(runs).toBe(2)
    expect(latest).toBeUndefined()

    dispose()
  })
})

// 响应式运行时：signal 与 map 的批量更新协作
describe("reactivity runtime", () => {
  it("creates signals and batches updates", () => {
    const count = createSignal(0)

    const seen: number[] = []

    const map = createSignalMap<string, number>()

    map.set("count", count.value)
    const dispose = createSignalEffect(() => {
      seen.push(map.get("count") ?? 0)
    })

    batchUpdates(() => {
      count.value = 1
      map.set("count", count.value)
      count.value = 2
      map.set("count", count.value)
    })

    expect(seen).toEqual([0, 2])

    dispose()
  })
})
