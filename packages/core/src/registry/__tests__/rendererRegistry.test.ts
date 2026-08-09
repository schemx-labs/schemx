/**
 * Registry 单元测试
 *
 * 覆盖 Registry 的所有公开 API：
 * register、registerAll、get、resolve、has、unregister、
 * keys、setFallback、getFallback、clear、size。
 *
 * @module core/registry/__tests__/rendererRegistry
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createRendererRegistry } from "../rendererRegistry"


const Comp1 = { name: "Comp1" }

const Comp2 = { name: "Comp2" }

const Comp3 = { name: "Comp3" }

// 验证 Registry 的 register/registerAll/get/resolve/has/unregister/setFallback/clear 等完整 API
describe("Registry", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // 验证 register/has/get 的基本注册、覆盖、override:false
  describe("register / has / get", () => {
    it("注册并获取渲染器", () => {
      const reg = createRendererRegistry()

      reg.register("text", Comp1)
      expect(reg.has("text")).toBe(true)
      expect(reg.get("text")).toBe(Comp1)
    })

    it("默认覆盖已存在的渲染器", () => {
      const reg = createRendererRegistry()

      reg.register("text", Comp1)
      reg.register("text", Comp2)
      expect(reg.get("text")).toBe(Comp2)
    })

    it("override: false 不覆盖已存在的渲染器", () => {
      const reg = createRendererRegistry()

      reg.register("text", Comp1)
      reg.register("text", Comp2, { override: false })
      expect(reg.get("text")).toBe(Comp1)
    })
  })

  // 验证 get 为纯查询、resolve 在未命中时回退到回退类型
  describe("get / resolve", () => {
    it("get 为纯查询，未注册时返回 undefined 且不回退", () => {
      const reg = createRendererRegistry<string>("text")

      reg.register("text", Comp1)
      expect(reg.get("unknown")).toBeUndefined()
    })

    it("resolve 未命中时回退到回退类型", () => {
      const reg = createRendererRegistry<string>("text")

      reg.register("text", Comp1)
      expect(reg.resolve("unknown")).toBe(Comp1)
    })

    it("resolve 回退类型也不存在时返回 undefined", () => {
      const reg = createRendererRegistry()

      expect(reg.resolve("anything")).toBeUndefined()
    })

    it("精确命中时 get 与 resolve 返回同一组件", () => {
      const reg = createRendererRegistry<string>("text")

      reg.register("text", Comp1)
      expect(reg.get("text")).toBe(Comp1)
      expect(reg.resolve("text")).toBe(Comp1)
    })
  })

  // 验证 registerAll 批量注册多个渲染器
  describe("registerAll", () => {
    it("批量注册多个渲染器", () => {
      const reg = createRendererRegistry()

      reg.registerAll({ text: Comp1, number: Comp2, select: Comp3 })
      expect(reg.size()).toBe(3)
      expect(reg.get("text")).toBe(Comp1)
      expect(reg.get("number")).toBe(Comp2)
      expect(reg.get("select")).toBe(Comp3)
    })
  })

  // 验证 unregister 移除已注册渲染器、不存在的返回 false、智能选择新回退、最后一个保留回退类型
  describe("unregister", () => {
    it("移除已注册的渲染器", () => {
      const reg = createRendererRegistry()

      reg.register("text", Comp1)
      expect(reg.unregister("text")).toBe(true)
      expect(reg.has("text")).toBe(false)
    })

    it("移除不存在的渲染器返回 false", () => {
      const reg = createRendererRegistry()

      expect(reg.unregister("nonexistent")).toBe(false)
    })

    it("移除回退类型时智能选择新回退", () => {
      const reg = createRendererRegistry()

      reg.register("text", Comp1)
      reg.register("number", Comp2)
      reg.setFallback("text")

      reg.unregister("text")
      // 应选择剩余渲染器中的第一个
      expect(reg.getFallback()).toBe("number")
    })

    it("移除最后一个渲染器时回退类型保持不变", () => {
      const reg = createRendererRegistry<string>("text")

      reg.register("text", Comp1)
      reg.unregister("text")
      expect(reg.getFallback()).toBe("text")
    })
  })

  // 验证 setFallback/getFallback 设置已注册类型为回退、未注册类型无效、构造时指定回退类型
  describe("setFallback / getFallback", () => {
    it("设置已注册的类型为回退", () => {
      const reg = createRendererRegistry()

      reg.register("text", Comp1)
      reg.register("number", Comp2)
      reg.setFallback("number")
      expect(reg.getFallback()).toBe("number")
    })

    it("设置未注册的类型无效", () => {
      const reg = createRendererRegistry<string>("text")

      reg.register("text", Comp1)
      reg.setFallback("nonexistent")
      expect(reg.getFallback()).toBe("text")
    })

    it("构造时回退类型为 undefined", () => {
      const reg = createRendererRegistry()

      expect(reg.getFallback()).toBeUndefined()
    })

    it("构造时可指定回退类型", () => {
      const reg = createRendererRegistry("custom")

      expect(reg.getFallback()).toBe("custom")
    })
  })

  // 验证 keys 返回所有已注册类型、size 返回数量、clear 清空所有渲染器
  describe("keys / size / clear", () => {
    it("keys 返回所有已注册类型", () => {
      const reg = createRendererRegistry()

      reg.registerAll({ text: Comp1, number: Comp2 })
      expect(reg.keys()).toEqual(expect.arrayContaining(["text", "number"]))
    })

    it("size 返回渲染器数量", () => {
      const reg = createRendererRegistry()

      expect(reg.size()).toBe(0)
      reg.register("text", Comp1)
      expect(reg.size()).toBe(1)
    })

    it("clear 清空所有渲染器", () => {
      const reg = createRendererRegistry()

      reg.registerAll({ text: Comp1, number: Comp2 })
      reg.setFallback("number")
      reg.clear()
      expect(reg.size()).toBe(0)
      expect(reg.getFallback()).toBeUndefined()
    })
  })

  // 验证 createRendererRegistry 工厂创建独立 Registry 实例
  describe("createRendererRegistry 工厂函数", () => {
    it("创建独立的 Registry 实例", () => {
      const reg = createRendererRegistry("number")

      expect(reg).toBeDefined()
      expect(reg.getFallback()).toBe("number")
    })
  })
})
