import { h } from "vue"

import { enableAutoUnmount, mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import SchemxForm from "../form.vue"
import Search from "../search.vue"

import { mockSearchGeometry } from "./helpers/searchGeometry"

import type { SchemxInstance, ScrollToFieldHighlightOptions } from "../types"
import type { CustomBehaviorOptions } from "scroll-into-view-if-needed"

/**
 * 滚动库的入口由测试控制，容器坐标由各用例模拟浏览器更新。
 */
const { scrollIntoViewMock } = vi.hoisted(() => ({ scrollIntoViewMock: vi.fn() }))

vi.mock("scroll-into-view-if-needed", () => ({ default: scrollIntoViewMock }))

/**
 * 本次定位计划移动的实际容器。
 */
let actions: Parameters<CustomBehaviorOptions<void>["behavior"]>[0]

/**
 * 挂载真实表单，保留字段注册、实例分发和高亮生命周期。
 * @param grouped - 是否将字段放入默认收起的 Group。
 */
function mountForm(grouped = false) {
  // 字段插槽隔离 Renderer，但仍使用真实的字段外层元素。
  const schemas = [{ name: "name", label: "姓名", componentType: "input" }]

  // 由自动卸载钩子统一清理，断言失败也不会遗留计时资源。
  const wrapper = mount(SchemxForm, {
    props: {
      schemas: grouped
        ? [
            {
              key: "group",
              label: "组",
              collapsible: true,
              defaultCollapsed: true,
              children: schemas,
            },
          ]
        : schemas,
    },
    slots: { name: () => h("input") },
    attachTo: document.body,
  })

  // 测试仅使用当前表单中存在的字段路径。
  const form = wrapper.vm as unknown as SchemxInstance<{ name: string }>

  return { wrapper, form }
}

/**
 * 创建不会自行到位的滚动容器，模拟原生平滑滚动。
 * @param top - 计划滚动到的垂直位置。
 * @param left - 计划滚动到的水平位置。
 */
function planScroll(top = 200, left = 0) {
  // 使用独立容器，测试可以分别控制内外层是否已到位。
  const el = document.createElement("div")

  Object.defineProperties(el, {
    scrollHeight: { value: 1000 },
    scrollWidth: { value: 1000 },
    clientHeight: { value: 100 },
    clientWidth: { value: 100 },
  })
  // 调用 scroll 只记录参数，避免 DOM 模拟器立即更新坐标。
  const scroll = vi.fn()

  el.scroll = scroll
  actions.push({ el, top, left })

  return { el, scroll }
}

/**
 * 检查当前提示是否显示。
 * @param element - 真实字段外层元素。
 */
function isHighlighted(element: Element): boolean {
  return element.classList.contains("schemx-field-wrapper--highlighted")
}

enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.useFakeTimers()
  actions = []
  scrollIntoViewMock.mockReset()
  // target 是定位字段，options 是传给滚动库的真实选项。
  scrollIntoViewMock.mockImplementation(
    (_target: Element, options: CustomBehaviorOptions<void>) => {
      if (typeof options.behavior === "function") {
        options.behavior(actions)
      }
    }
  )
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
  } as DOMRectList)
  // callback 由测试的虚拟时钟每 16ms 执行一次。
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
    window.setTimeout(() => callback(performance.now()), 16)
  )
  // handle 是上面动画帧对应的虚拟定时器。
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) =>
    window.clearTimeout(handle)
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("scrollToField highlight", () => {
  it("highlight:false 不显示提示，仍然正常发起滚动", async () => {
    // 关闭高亮后不创建提示监听或临时样式。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get(".schemx-field-wrapper").element

    // 记录定位期间新增的全局监听。
    const listen = vi.spyOn(window, "addEventListener")

    await form.scrollToField("name", { highlight: false })
    expect(isHighlighted(target)).toBe(false)
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(
      target,
      expect.objectContaining({ behavior: "smooth" })
    )
    expect(listen).not.toHaveBeenCalledWith(
      "wheel",
      expect.any(Function),
      expect.anything()
    )
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  // type 为本次提示的视觉类型，覆盖省略、合法值与 JavaScript 无效输入。
  it.each([undefined, "default", "warning", "error", "invalid"])(
    "高亮类型 %s 使用对应样式并在结束时清理",
    async (type) => {
      // 使用真实字段验证提示状态，不改变校验错误。
      const { wrapper, form } = mountForm()

      // 本次定位对应的字段外层 DOM。
      const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

      // 模拟 JavaScript 调用方绕过静态类型检查。
      const highlight = { type } as ScrollToFieldHighlightOptions

      // 未配置和无效类型均回退默认样式。
      const expectedType = type === "warning" || type === "error" ? type : "default"

      await form.scrollToField("name", { highlight })
      expect(
        target.classList.contains(`schemx-field-wrapper--highlight-${expectedType}`)
      ).toBe(true)
      expect(target.classList.contains("is-error")).toBe(false)
      vi.advanceTimersByTime(1500)
      expect(target.className).not.toContain("schemx-field-wrapper--highlight")
    }
  )

  it("连续切换类型、关闭提示及卸载时清除类型类名", async () => {
    // 持续高亮与定时高亮切换时不应保留旧类型。
    const { wrapper, form } = mountForm()

    // 卸载后仍保留引用，以验证清理实际作用于原节点。
    const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

    await form.scrollToField("name", { highlight: { type: "warning", duration: 0 } })
    await form.scrollToField("name", { highlight: { type: "error" } })
    expect(target.classList.contains("schemx-field-wrapper--highlight-warning")).toBe(
      false
    )
    expect(target.classList.contains("schemx-field-wrapper--highlight-error")).toBe(true)
    await form.scrollToField("name")
    expect(target.classList.contains("schemx-field-wrapper--highlight-error")).toBe(false)
    expect(target.classList.contains("schemx-field-wrapper--highlight-default")).toBe(
      true
    )
    await form.scrollToField("name", { highlight: false })
    expect(target.className).not.toContain("schemx-field-wrapper--highlight")
    await form.scrollToField("name", { highlight: { type: "error", duration: 0 } })
    wrapper.unmount()
    expect(target.className).not.toContain("schemx-field-wrapper--highlight")
  })

  it("无需滚动时立即提示，默认 1500ms 后恢复原有内联变量", async () => {
    // 原有变量和 important 优先级必须在结束后恢复。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

    target.style.setProperty("--schemx-field-highlight-duration", "700ms", "important")
    expect(await form.scrollToField("name", { highlight: true })).toBe(true)
    expect(isHighlighted(target)).toBe(true)
    expect(target.style.getPropertyValue("--schemx-field-highlight-duration")).toBe(
      "1500ms"
    )
    vi.advanceTimersByTime(1499)
    expect(isHighlighted(target)).toBe(true)
    vi.advanceTimersByTime(1)
    expect(isHighlighted(target)).toBe(false)
    expect(target.style.getPropertyValue("--schemx-field-highlight-duration")).toBe(
      "700ms"
    )
    expect(target.style.getPropertyPriority("--schemx-field-highlight-duration")).toBe(
      "important"
    )
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([2000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "持续时间 %s 使用约定的默认值或自定义值",
    async (duration) => {
      // 非有限值和负数均回退 1500ms。
      const { wrapper, form } = mountForm()

      // 本次定位对应的字段外层 DOM。
      const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

      await form.scrollToField("name", { highlight: { duration } })
      vi.advanceTimersByTime(duration === 2000 ? 1999 : 1499)
      expect(isHighlighted(target)).toBe(true)
      vi.advanceTimersByTime(1)
      expect(isHighlighted(target)).toBe(false)
      expect(target.style.getPropertyValue("--schemx-field-highlight-duration")).toBe("")
    }
  )

  it("全部嵌套容器到位后才开始提示，返回值不等待滚动或高亮结束", async () => {
    // 两个祖先分别模拟垂直滚动和水平滚动。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get(".schemx-field-wrapper").element

    // 先到位的内层滚动容器。
    const inner = planScroll(200)

    // 最后到位的外层滚动容器。
    const outer = planScroll(300, 100)

    expect(await form.scrollToField("name", { highlight: true })).toBe(true)
    expect(inner.scroll).toHaveBeenCalledWith({ top: 200, left: 0, behavior: "smooth" })
    inner.el.scrollTop = 200
    vi.advanceTimersByTime(200)
    expect(isHighlighted(target)).toBe(false)
    outer.el.scrollTop = 300
    outer.el.scrollLeft = 100
    vi.advanceTimersByTime(16)
    expect(isHighlighted(target)).toBe(false)
    vi.advanceTimersByTime(16)
    expect(isHighlighted(target)).toBe(true)
    vi.advanceTimersByTime(1500)
    expect(isHighlighted(target)).toBe(false)
  })

  it("保留 scroll-margin 修正和可达边界，auto 也等待实际到位", async () => {
    // 超过容器边界的坐标按浏览器可达范围观察。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

    target.style.scrollMarginTop = "20px"
    // 由测试手动更新坐标的滚动容器。
    const container = planScroll(200, 1000)

    await form.scrollToField("name", { behavior: "auto", highlight: true })
    expect(container.scroll).toHaveBeenCalledWith({
      top: 180,
      left: 900,
      behavior: "auto",
    })
    container.el.scrollTop = 180
    container.el.scrollLeft = 900
    vi.advanceTimersByTime(32)
    expect(isHighlighted(target)).toBe(true)
  })

  it.each(["wheel", "touchmove", "keydown"])(
    "%s 中断等待时释放资源，不再出现高亮",
    async (event) => {
      // 用户开始新的交互后不再弹出旧定位提示。
      const { wrapper, form } = mountForm()

      // 本次定位对应的字段外层 DOM。
      const target = wrapper.get(".schemx-field-wrapper").element

      // 由测试手动更新坐标的滚动容器。
      const container = planScroll()

      await form.scrollToField("name", { highlight: true })
      window.dispatchEvent(
        event === "keydown"
          ? new KeyboardEvent(event, { key: "PageDown" })
          : new Event(event)
      )
      container.el.scrollTop = 200
      vi.advanceTimersByTime(100)
      expect(isHighlighted(target)).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it("默认开启高亮，沿用 1500ms 持续时间", async () => {
    // 缺省选项使用当前默认开启的行为。
    const { wrapper, form } = mountForm()

    // 已注册字段的真实外层。
    const target = wrapper.get(".schemx-field-wrapper").element

    await form.scrollToField("name")
    expect(isHighlighted(target)).toBe(true)
    vi.advanceTimersByTime(1500)
    expect(isHighlighted(target)).toBe(false)
  })

  it("duration:0 持续显示，不启动淡出、结束定时器或逐帧轮询", async () => {
    // 持续模式不能被默认 1500ms 或等待阶段的 3 秒计时器终止。
    const { wrapper, form } = mountForm()

    // 已注册字段的真实外层。
    const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

    await form.scrollToField("name", { highlight: { duration: 0 } })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(isHighlighted(target)).toBe(true)
    expect(target.classList.contains("schemx-field-wrapper--highlight-persistent")).toBe(
      true
    )
    expect(target.style.getPropertyValue("--schemx-field-highlight-duration")).toBe("")
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, 2000])(
    "持续时间 %s 的高亮不被区域外操作或任意按键关闭",
    async (duration) => {
      // duration 是本用例的持续显示值 0 或有限时长。
      const { wrapper, form } = mountForm()

      // 已注册字段的真实外层。
      const target = wrapper.get(".schemx-field-wrapper").element

      await form.scrollToField("name", { highlight: { duration } })
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }))
      document.body.dispatchEvent(new Event("click", { bubbles: true }))
      document.body.dispatchEvent(new Event("input", { bubbles: true }))
      window.dispatchEvent(new Event("wheel"))
      window.dispatchEvent(new Event("touchmove"))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }))
      wrapper
        .get("input")
        .element.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Shift", bubbles: true })
        )
      expect(isHighlighted(target)).toBe(true)
      vi.advanceTimersByTime(2000)
      expect(isHighlighted(target)).toBe(duration === 0)
    }
  )

  it.each(["pointerdown", "click", "input", "change"])(
    "目标子节点的 %s 关闭提示，且不拦截控件事件",
    async (eventType) => {
      // eventType 覆盖鼠标或触摸点击、键盘激活及编辑结果。
      const { wrapper, form } = mountForm()

      // 已注册字段的真实外层。
      const target = wrapper.get(".schemx-field-wrapper").element

      // 子控件处理函数即使停止冒泡，也应先清除提示。
      const input = wrapper.get("input").element

      // 记录事件到达原控件时的高亮状态。
      const handle = vi.fn((event: Event) => {
        expect(isHighlighted(target)).toBe(false)
        event.stopPropagation()
      })

      input.addEventListener(eventType, handle)
      await form.scrollToField("name", { highlight: { duration: 0 } })
      // 模拟控件发出的可取消事件，确认提示逻辑没有阻止默认行为。
      const event = new Event(eventType, { bubbles: true, cancelable: true })

      expect(input.dispatchEvent(event)).toBe(true)
      expect(event.defaultPrevented).toBe(false)
      expect(handle).toHaveBeenCalledOnce()
      expect(isHighlighted(target)).toBe(false)
      expect(
        target.classList.contains("schemx-field-wrapper--highlight-persistent")
      ).toBe(false)
    }
  )

  it("等待阶段忽略区域外普通输入，仍能在到位后提示", async () => {
    // 无关按键和区域外指针操作不代表滚动被中断。
    const { wrapper, form } = mountForm()

    // 计划移动的容器由测试手动更新。
    const container = planScroll()

    await form.scrollToField("name", { highlight: { duration: 0 } })
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }))
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }))
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }))
    container.el.scrollTop = 200
    vi.advanceTimersByTime(32)
    expect(isHighlighted(wrapper.get(".schemx-field-wrapper").element)).toBe(true)
    // 进入展示阶段后不再安排动画帧检查。
    vi.mocked(window.requestAnimationFrame).mockClear()
    vi.advanceTimersByTime(60_000)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it("等待期间操作目标区域也会取消提示", async () => {
    // 避免用户已开始编辑后才显示旧定位提示。
    const { wrapper, form } = mountForm()

    // 计划移动的容器由测试手动更新。
    const container = planScroll()

    await form.scrollToField("name", { highlight: { duration: 0 } })
    await wrapper.get("input").trigger("input")
    container.el.scrollTop = 200
    vi.advanceTimersByTime(32)
    expect(isHighlighted(wrapper.get(".schemx-field-wrapper").element)).toBe(false)
  })

  it.each(["inert", "visibility", "remove"])(
    "持续提示在祖先 %s 变化后清理",
    async (change) => {
      // change 分别模拟 Search 收起、祖先隐藏和区域卸载。
      const { wrapper, form } = mountForm()

      // 已注册字段的真实外层。
      const target = wrapper.get(".schemx-field-wrapper").element

      // Search 和 Group 等外层容器同样能使字段失效。
      const ancestor = wrapper.element

      await form.scrollToField("name", { highlight: { duration: 0 } })
      if (change === "inert") {
        ancestor.setAttribute("inert", "")
      } else if (change === "visibility") {
        ancestor.setAttribute("style", "visibility:hidden")
      } else {
        ancestor.remove()
      }

      await vi.advanceTimersByTimeAsync(32)
      expect(isHighlighted(target)).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    }
  )

  it("持续提示被新请求取代或组件卸载时清理全部资源", async () => {
    // 依次覆盖持续到有限时长、有限到持续时长以及卸载。
    const { wrapper, form } = mountForm()

    // 已注册字段的真实外层。
    const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

    await form.scrollToField("name", { highlight: { duration: 0 } })
    await form.scrollToField("name", { highlight: { duration: 2000 } })
    expect(target.classList.contains("schemx-field-wrapper--highlight-persistent")).toBe(
      false
    )
    expect(target.style.getPropertyValue("--schemx-field-highlight-duration")).toBe(
      "2000ms"
    )
    await form.scrollToField("name", { highlight: { duration: 0 } })
    expect(target.style.getPropertyValue("--schemx-field-highlight-duration")).toBe("")
    wrapper.unmount()
    expect(isHighlighted(target)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it("等待超时后跳过提示，容器随后到位也不会复活旧请求", async () => {
    // 模拟滚动被吸附或其他逻辑截断。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get(".schemx-field-wrapper").element

    // 由测试手动更新坐标的滚动容器。
    const container = planScroll()

    await form.scrollToField("name", { highlight: true })
    vi.advanceTimersByTime(3000)
    container.el.scrollTop = 200
    vi.advanceTimersByTime(100)
    expect(isHighlighted(target)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("重复定位重启持续时间，新请求即使关闭高亮也清除旧提示", async () => {
    // 同一字段的提示寿命以最后一次定位为准。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get(".schemx-field-wrapper").element

    await form.scrollToField("name", { highlight: true })
    vi.advanceTimersByTime(1000)
    await form.scrollToField("name", { highlight: true })
    vi.advanceTimersByTime(1000)
    expect(isHighlighted(target)).toBe(true)
    await form.scrollToField("name", { highlight: false })
    expect(isHighlighted(target)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("新请求取消旧等待，未找到字段时也不会遗留提示", async () => {
    // 失败的最新请求也使旧提示失效。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get(".schemx-field-wrapper").element

    // 由测试手动更新坐标的滚动容器。
    const container = planScroll()

    await form.scrollToField("name", { highlight: true })
    expect(await form.scrollToField("missing" as never, { highlight: true })).toBe(false)
    container.el.scrollTop = 200
    vi.advanceTimersByTime(100)
    expect(isHighlighted(target)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("移除字段时清除活动提示", async () => {
    // 字段离开文档后，不需要等待完整持续时间。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get(".schemx-field-wrapper").element

    await form.scrollToField("name", { highlight: true })
    target.remove()
    await vi.advanceTimersByTimeAsync(32)
    expect(isHighlighted(target)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("卸载期间的异步请求不发起滚动，活动等待也在卸载时清理", async () => {
    // 先验证开始等待后卸载，再验证 nextTick 尚未完成就卸载。
    const first = mountForm()

    planScroll()
    await first.form.scrollToField("name", { highlight: true })
    first.wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    scrollIntoViewMock.mockClear()
    const second = mountForm()

    // 卸载前尚未结束的异步定位。
    const pending = second.form.scrollToField("name", { highlight: true })

    second.wrapper.unmount()
    expect(await pending).toBe(false)
    expect(scrollIntoViewMock).not.toHaveBeenCalled()
  })

  it("多个表单分别保留提示，卸载仅清理当前组件", async () => {
    // 独立组件拥有独立的计时与高亮状态。
    const first = mountForm()

    const second = mountForm()

    // 第一个组件拥有的提示元素。
    const firstTarget = first.wrapper.get(".schemx-field-wrapper").element

    // 第二个组件拥有的提示元素。
    const secondTarget = second.wrapper.get(".schemx-field-wrapper").element

    await first.form.scrollToField("name", { highlight: true })
    await second.form.scrollToField("name", { highlight: true })
    first.wrapper.unmount()
    expect(isHighlighted(firstTarget)).toBe(false)
    expect(isHighlighted(secondTarget)).toBe(true)
    second.wrapper.unmount()
    expect(isHighlighted(secondTarget)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("展开 Group 后在重新挂载的目标上提示", async () => {
    // 提示复用原有的分组展开流程。
    const { wrapper, form } = mountForm(true)

    expect(wrapper.find(".schemx-field-wrapper").exists()).toBe(false)
    expect(await form.scrollToField("name", { highlight: true })).toBe(true)
    expect(isHighlighted(wrapper.get(".schemx-field-wrapper").element)).toBe(true)
  })

  it("Search 展开后才在折叠字段上提示", async () => {
    // 用布局模拟驱动真实 Search 的 inert 与展开流程。
    mockSearchGeometry()
    const wrapper = mount(Search, {
      props: {
        schemas: [
          { name: "first", label: "首项", componentType: "input", col: { span: 24 } },
          { name: "second", label: "次项", componentType: "input", col: { span: 24 } },
        ],
      },
      slots: { first: () => h("input"), second: () => h("input") },
      attachTo: document.body,
    })

    // 显式描述该测试使用的两个字段。
    const form = wrapper.vm as unknown as SchemxInstance<{
      first: string
      second: string
    }>

    expect(await form.scrollToField("second", { highlight: true })).toBe(true)
    expect(wrapper.find("[inert]").exists()).toBe(false)
    expect(
      wrapper
        .findAll(".schemx-field-wrapper")
        .map((field) => isHighlighted(field.element))
    ).toEqual([false, true])
  })

  it("并发调用仅处理最后一个请求", async () => {
    // 第一次调用尚在等待 nextTick 时，第二次请求立即取代它。
    const { form } = mountForm()

    const first = form.scrollToField("name", { highlight: true })

    const second = form.scrollToField("name", { highlight: false })

    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()
  })

  it("等待期间移除或隐藏字段时取消提示", async () => {
    // 可见性变化不能让已失效的滚动请求稍后提示。
    const { wrapper, form } = mountForm()

    // 本次定位对应的字段外层 DOM。
    const target = wrapper.get<HTMLElement>(".schemx-field-wrapper").element

    // 由测试手动更新坐标的滚动容器。
    const container = planScroll()

    await form.scrollToField("name", { highlight: true })
    target.style.visibility = "hidden"
    container.el.scrollTop = 200
    vi.advanceTimersByTime(32)
    expect(isHighlighted(target)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("减少动态效果时使用 instant，容器到位后仍显示提示", async () => {
    // 系统偏好覆盖 smooth，也避免 auto 被 CSS scroll-behavior 重新平滑化。
    const { wrapper, form } = mountForm()

    // 可覆写系统动态效果偏好的媒体查询。
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")

    Object.defineProperty(media, "matches", { value: true })
    vi.spyOn(window, "matchMedia").mockReturnValue(media)
    // 由测试手动更新坐标的滚动容器。
    const container = planScroll()

    await form.scrollToField("name", { highlight: true })
    expect(container.scroll).toHaveBeenCalledWith({
      top: 200,
      left: 0,
      behavior: "instant",
    })
    container.el.scrollTop = 200
    vi.advanceTimersByTime(32)
    expect(isHighlighted(wrapper.get(".schemx-field-wrapper").element)).toBe(true)
  })
})
