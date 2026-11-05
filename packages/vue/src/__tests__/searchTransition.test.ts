import { h } from "vue"

import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import Search from "../search.vue"

import { mockSearchGeometry } from "./helpers/searchGeometry"

import type { SchemxInstance } from "../types"

// 保留真实展开流程，只记录定位时交给滚动库的目标。
const { scrollIntoViewMock } = vi.hoisted(() => ({ scrollIntoViewMock: vi.fn() }))

vi.mock("scroll-into-view-if-needed", () => ({ default: scrollIntoViewMock }))

/**
 * 只模拟高度过渡实际使用的浏览器动画接口。
 */
interface TestAnimation {
  /**
   * 取消旧动画并撤销其临时样式。
   */
  cancel: () => void
  /**
   * 浏览器在动画自然结束时触发的回调。
   */
  onfinish: (() => void) | null
}

/**
 * 创建带可测布局和可控动画的真实 Search。
 */
async function mountAnimatedSearch() {
  // 字段整体插槽隔离 Renderer 实现，仍保留 SchemaList 的真实挂载路径。
  const wrapper = mount(Search, {
    props: {
      schemas: [
        { name: "first", label: "首项", componentType: "input", col: { span: 24 } },
        { name: "second", label: "次项", componentType: "input", col: { span: 24 } },
      ],
    },
    slots: {
      first: () => h("input"),
      second: () => h("input"),
    },
    attachTo: document.body,
  })

  await flushPromises()

  // 只有字段容器参与高度过渡，操作区始终保留。
  const element = wrapper.get<HTMLElement>(".schemx-search-fields").element

  // DOM 环境没有布局引擎，以实际挂载行数模拟自然高度。
  const measure = vi.fn(
    () => new DOMRect(0, 0, 200, Number.parseFloat(element.style.height) || 80)
  )

  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: measure,
  })

  // 每次过渡使用独立动画，测试可触发完成或检查取消。
  const animations: TestAnimation[] = []

  // 在测试边界安装最小 WAAPI 实现，不伪造完整 Animation 类型。
  const animate = vi.fn(() => {
    // 当前一次动画的取消记录和完成回调。
    const animation: TestAnimation = { cancel: vi.fn(), onfinish: null }

    animations.push(animation)

    return animation
  })

  Object.defineProperty(element, "animate", { configurable: true, value: animate })

  return { wrapper, element, measure, animate, animations }
}

beforeEach(() => {
  mockSearchGeometry()
  scrollIntoViewMock.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Search 高度过渡", () => {
  it("展开和收起分别过渡到自然高度，收起保持全部字段挂载", async () => {
    // 以输入数量验证动画没有额外保留已折叠字段。
    const { wrapper, animate, animations } = await mountAnimatedSearch()

    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(wrapper.findAll("input")).toHaveLength(2)
    expect(animate).toHaveBeenLastCalledWith(
      [
        { height: "40px", overflow: "clip" },
        { height: "80px", overflow: "clip" },
      ],
      { duration: 250, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    )
    animations[0]?.onfinish?.()
    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(wrapper.findAll("input")).toHaveLength(2)
    expect(animate).toHaveBeenLastCalledWith(
      [
        { height: "80px", overflow: "clip" },
        { height: "40px", overflow: "clip" },
      ],
      { duration: 250, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    )
    wrapper.unmount()
  })

  it("定位折叠字段期间只裁剪内容，再收起恢复首行布局", async () => {
    // DOM 模拟器不提供可见矩形，字段注册仍走真实路径。
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      length: 1,
    } as DOMRectList)
    // 动画保持未结束，覆盖定位发生在展开过渡中的场景。
    const { wrapper, element, animate, animations } = await mountAnimatedSearch()

    // Search 公开的表单实例支持这两个已声明的字段。
    const form = wrapper.vm as unknown as SchemxInstance<{
      first: string
      second: string
    }>

    expect(await form.scrollToField("second")).toBe(true)
    await flushPromises()
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      wrapper.findAll(".schemx-field-wrapper")[1]?.element,
      expect.objectContaining({ scrollMode: "if-needed" })
    )
    expect(animate).toHaveBeenLastCalledWith(
      [
        { height: "40px", overflow: "clip" },
        { height: "80px", overflow: "clip" },
      ],
      expect.any(Object)
    )
    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(animations[0]?.cancel).toHaveBeenCalledOnce()
    expect(element.classList.contains("is-collapsed")).toBe(true)
    expect(element.style.height).toBe("40px")
    expect(wrapper.findAll("input")).toHaveLength(2)
    expect(
      wrapper.findAll("input").filter((input) => !input.element.closest("[inert]"))
    ).toHaveLength(1)
    wrapper.unmount()
  })

  it("反向切换从动画中的可见高度继续，卸载时取消活动动画", async () => {
    // measure 用于模拟第一段动画播放到中途的高度。
    const { wrapper, measure, animate, animations } = await mountAnimatedSearch()

    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    measure.mockReturnValueOnce(new DOMRect(0, 0, 200, 65))
    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(animations[0]?.cancel).toHaveBeenCalledOnce()
    expect(animate).toHaveBeenLastCalledWith(
      [
        { height: "65px", overflow: "clip" },
        { height: "40px", overflow: "clip" },
      ],
      { duration: 250, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    )
    wrapper.unmount()
    expect(animations[1]?.cancel).toHaveBeenCalledOnce()
  })

  it("动画结束后释放引用，后续字段内容可继续自然增高", async () => {
    // 已结束的动画不应在组件销毁时再次取消。
    const { wrapper, element, animations } = await mountAnimatedSearch()

    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    animations[0]?.onfinish?.()
    expect(element.style.height).toBe("")
    expect(element.style.overflow).toBe("")
    wrapper.unmount()
    expect(animations[0]?.cancel).not.toHaveBeenCalled()
  })

  it("减少动态效果时直接切换，仍正确限制高度", async () => {
    // 复用真实 MediaQueryList，只将系统偏好改为减少动态效果。
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")

    Object.defineProperty(media, "matches", { value: true })
    vi.spyOn(window, "matchMedia").mockReturnValue(media)
    const { wrapper, animate } = await mountAnimatedSearch()

    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(wrapper.findAll("input")).toHaveLength(2)
    expect(animate).not.toHaveBeenCalled()
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(wrapper.findAll("input")).toHaveLength(2)
    wrapper.unmount()
  })

  it("浏览器不支持动画时直接切换", async () => {
    // 模拟未实现 Web Animations API 的浏览器。
    const { wrapper, element } = await mountAnimatedSearch()

    Object.defineProperty(element, "animate", { value: undefined })
    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(wrapper.findAll("input")).toHaveLength(2)
    wrapper.unmount()
  })

  it("受控调用方拒绝切换时不播放动画", async () => {
    // 实际折叠状态未变时，DOM 和动画都保持不变。
    const { wrapper, animate } = await mountAnimatedSearch()

    await wrapper.setProps({ collapse: { collapsed: true } })
    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(wrapper.findAll("input")).toHaveLength(2)
    expect(animate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it("更新尚未完成就卸载时，不启动过期动画", async () => {
    // 在 Vue 刷新前销毁组件，验证异步测量不会泄漏。
    const { wrapper, animate } = await mountAnimatedSearch()

    // 本次受控更新可能尚在队列内。
    const update = wrapper.setProps({ collapse: { collapsed: false } })

    wrapper.unmount()
    await update
    await flushPromises()
    expect(animate).not.toHaveBeenCalled()
  })
})
