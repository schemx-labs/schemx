/**
 * Registry 单元测试
 *
 * 覆盖 Registry 的所有公开 API：
 * register、registerAll、getRenderer、hasRenderer、unregister、
 * getTypes、setDefault、getDefault、clear、size。
 *
 * @module core/registry/__tests__/rendererRegistry
 */

import { defineComponent } from "vue"

import { describe, expect, it } from "vitest"

import { createRendererRegistry } from "../rendererRegistry"

import type { RendererRegistry } from "../rendererRegistry"

const Comp1 = defineComponent({ render: () => null })
const Comp2 = defineComponent({ render: () => null })
const Comp3 = defineComponent({ render: () => null })

describe("Registry", () => {
  describe("register / hasRenderer / getRenderer", () => {
    it("注册并获取渲染器", () => {
      const reg = createRendererRegistry()
      reg.register("text", Comp1)
      expect(reg.hasRenderer("text")).toBe(true)
      expect(reg.getRenderer("text")).toBe(Comp1)
    })

    it("默认覆盖已存在的渲染器", () => {
      const reg = createRendererRegistry()
      reg.register("text", Comp1)
      reg.register("text", Comp2)
      expect(reg.getRenderer("text")).toBe(Comp2)
    })

    it("override: false 不覆盖已存在的渲染器", () => {
      const reg = createRendererRegistry()
      reg.register("text", Comp1)
      reg.register("text", Comp2, { override: false })
      expect(reg.getRenderer("text")).toBe(Comp1)
    })

    it("未找到时回退到默认类型", () => {
      const reg = createRendererRegistry("text")
      reg.register("text", Comp1)
      expect(reg.getRenderer("unknown")).toBe(Comp1)
    })

    it("默认类型也不存在时返回 undefined", () => {
      const reg = createRendererRegistry()
      expect(reg.getRenderer("anything")).toBeUndefined()
    })
  })

  describe("registerAll", () => {
    it("批量注册多个渲染器", () => {
      const reg = createRendererRegistry()
      reg.registerAll({ text: Comp1, number: Comp2, select: Comp3 })
      expect(reg.size()).toBe(3)
      expect(reg.getRenderer("text")).toBe(Comp1)
      expect(reg.getRenderer("number")).toBe(Comp2)
      expect(reg.getRenderer("select")).toBe(Comp3)
    })
  })

  describe("unregister", () => {
    it("移除已注册的渲染器", () => {
      const reg = createRendererRegistry()
      reg.register("text", Comp1)
      expect(reg.unregister("text")).toBe(true)
      expect(reg.hasRenderer("text")).toBe(false)
    })

    it("移除不存在的渲染器返回 false", () => {
      const reg = createRendererRegistry()
      expect(reg.unregister("nonexistent")).toBe(false)
    })

    it("移除默认类型时智能选择新默认", () => {
      const reg = createRendererRegistry()
      reg.register("text", Comp1)
      reg.register("number", Comp2)
      reg.setDefault("text")

      reg.unregister("text")
      // 应选择剩余渲染器中的第一个
      expect(reg.getDefault()).toBe("number")
    })

    it("移除最后一个渲染器时默认类型保持不变", () => {
      const reg = createRendererRegistry("text")
      reg.register("text", Comp1)
      reg.unregister("text")
      expect(reg.getDefault()).toBe("text")
    })
  })

  describe("setDefault / getDefault", () => {
    it("设置已注册的类型为默认", () => {
      const reg = createRendererRegistry()
      reg.register("text", Comp1)
      reg.register("number", Comp2)
      reg.setDefault("number")
      expect(reg.getDefault()).toBe("number")
    })

    it("设置未注册的类型无效", () => {
      const reg = createRendererRegistry("text")
      reg.register("text", Comp1)
      reg.setDefault("nonexistent")
      expect(reg.getDefault()).toBe("text")
    })

    it("构造时默认类型为 undefined", () => {
      const reg = createRendererRegistry()
      expect(reg.getDefault()).toBeUndefined()
    })

    it("构造时可指定默认类型", () => {
      const reg = createRendererRegistry("custom")
      expect(reg.getDefault()).toBe("custom")
    })
  })

  describe("getTypes / size / clear", () => {
    it("getTypes 返回所有已注册类型", () => {
      const reg = createRendererRegistry()
      reg.registerAll({ text: Comp1, number: Comp2 })
      expect(reg.getTypes()).toEqual(expect.arrayContaining(["text", "number"]))
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
      reg.setDefault("number")
      reg.clear()
      expect(reg.size()).toBe(0)
    })
  })

  describe("createRendererRegistry 工厂函数", () => {
    it("创建独立的 Registry 实例", () => {
      const reg = createRendererRegistry("number")
      expect(reg).toBeDefined()
      expect(reg.getDefault()).toBe("number")
    })
  })
})
