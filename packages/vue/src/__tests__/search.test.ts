import { createApp, defineComponent, h, markRaw, ref } from "vue"

import { createForm, createRendererRegistry } from "@schemx/core"
import { flushPromises, mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createSchemx, createSearchComponent, SchemxSearch } from "../index"
import Search from "../search.vue"

import { mockSearchGeometry } from "./helpers/searchGeometry"

import type { SchemxField, SchemxInstance, Values } from "../index"
import type { VueWrapper } from "@vue/test-utils"

// 记录挂载次数，验证折叠不再重新创建 Renderer。
const mountedFields = vi.fn()

// DOM 滚动交给 spy，布局由测试提供可见矩形。
const { scrollIntoViewMock } = vi.hoisted(() => ({ scrollIntoViewMock: vi.fn() }))

vi.mock("scroll-into-view-if-needed", () => ({ default: scrollIntoViewMock }))

// 通过真实 Field 渲染路径读写表单值。
const Input = markRaw(
  defineComponent({
    inheritAttrs: false,
    /**
     * 记录挂载并将 Field 的 v-model 桥接到原生输入。
     * @param _props - 未声明独立 Props。
     * @param context - Field 透传的渲染器属性。
     */
    setup(_props, context) {
      mountedFields()

      return () =>
        h("input", {
          value: context.attrs.value,
          // event 是用户修改原生输入的事件。
          onInput: (event: Event) => {
            if (event.target instanceof HTMLInputElement) {
              // Field 为 Renderer 提供的值同步事件。
              const update = context.attrs["onUpdate:value"]

              if (typeof update === "function") {
                update(event.target.value)
              }
            }
          },
        })
    },
  })
)

// 测试专用 Registry，不修改 Vue 包的默认 Registry。
const rendererRegistry = createRendererRegistry()

rendererRegistry.register("input", Input)

/**
 * 创建独立字段列表，各字段都走 Core 到 Field 的完整路径。
 * @param spans - 各字段占用的栅格数。
 */
function fields(spans: number[]): SchemxField<Values>[] {
  // span 是当前字段宽度，index 用来生成稳定且唯一的字段路径。
  return spans.map((span, index) => ({
    name: `field${index}`,
    label: `条件${index}`,
    componentType: "input",
    col: { span },
  }))
}

/**
 * 返回当前允许交互的输入，不将保持挂载的折叠字段算入首行。
 * @param wrapper - 当前测试组件宿主。
 */
function visibleInputs(wrapper: VueWrapper) {
  // input 是实际挂载的输入控件。
  return wrapper.findAll("input").filter((input) => !input.element.closest("[inert]"))
}

// 每个用例拥有独立容器尺寸和观察者。
let geometry: ReturnType<typeof mockSearchGeometry>

beforeEach(() => {
  geometry = mockSearchGeometry()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  mountedFields.mockClear()
  scrollIntoViewMock.mockClear()
})

describe("SchemxSearch", () => {
  it("只显示第一行，展开收起均保留全部 Renderer", async () => {
    // 记录非受控状态下的折叠切换通知。
    const onCollapsedChange = vi.fn()

    // 第二个字段超出第一行，后面的窄字段也不能跨过它补位。
    const wrapper = mount(Search, {
      props: {
        rendererRegistry,
        schemas: fields([8, 20, 4]),
        collapse: { onCollapsedChange },
      },
    })

    await flushPromises()

    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect(mountedFields).toHaveBeenCalledTimes(3)
    expect(wrapper.findAll("input")).toHaveLength(3)
    expect(wrapper.get(".schemx-search-collapse").attributes("aria-expanded")).toBe(
      "false"
    )
    expect(wrapper.get(".schemx-search-collapse").attributes("aria-controls")).toBe(
      wrapper.get(".schemx-search-fields").attributes("id")
    )
    expect(wrapper.get(".schemx-actions-button--submit").text()).toBe("查询")
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(3)
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("收起")
    expect(wrapper.get(".schemx-search-collapse").attributes("aria-expanded")).toBe(
      "true"
    )
    expect(wrapper.get<HTMLElement>(".schemx-search-toggle").element.style.display).toBe(
      ""
    )
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("展开")
    expect(wrapper.get<HTMLElement>(".schemx-search-toggle").element.style.display).toBe(
      ""
    )
    expect(wrapper.get(".schemx-search-toggle").attributes("inert")).toBeUndefined()
    expect(wrapper.get(".schemx-search-toggle").attributes("aria-hidden")).toBeUndefined()
    expect(onCollapsedChange.mock.calls).toEqual([[false], [true]])
    wrapper.unmount()
  })

  it("不可见节点不占位，栅格与 Schema 更新会重算折叠范围", async () => {
    // 隐藏首字段不应挤占后面字段的第一行。
    const schemas = fields([24, 12, 12, 12])

    schemas[0] = { name: "hidden", label: "隐藏", componentType: "input", visible: false }
    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(Search, { props: { rendererRegistry, schemas } })

    await flushPromises()

    expect(visibleInputs(wrapper)).toHaveLength(2)
    await wrapper.setProps({ schemas: fields([24]) })
    await vi.waitFor(() => expect(visibleInputs(wrapper)).toHaveLength(1))
    expect(wrapper.find(".schemx-search-collapse").exists()).toBe(false)
    await wrapper.setProps({ schemas: fields([6, 6, 6, 6, 6]) })
    await vi.waitFor(() => expect(visibleInputs(wrapper)).toHaveLength(4))
    expect(wrapper.find(".schemx-search-collapse").exists()).toBe(true)
    wrapper.unmount()
  })

  it("受控状态只发出请求，撤销控制后沿用最后的受控值", async () => {
    // 受控回调只请求更新，不直接修改外部状态。
    const onCollapsedChange = vi.fn()

    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(Search, {
      props: {
        rendererRegistry,
        schemas: fields([24, 24]),
        collapse: { collapsed: true, onCollapsedChange },
      },
    })

    await flushPromises()

    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect(onCollapsedChange.mock.calls).toEqual([[false]])
    await wrapper.setProps({ collapse: { collapsed: false, onCollapsedChange } })
    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("收起")
    expect(wrapper.get<HTMLElement>(".schemx-search-toggle").element.style.display).toBe(
      ""
    )
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(onCollapsedChange.mock.calls.at(-1)).toEqual([true])
    expect(visibleInputs(wrapper)).toHaveLength(2)
    await wrapper.setProps({ collapse: { onCollapsedChange } })
    expect(visibleInputs(wrapper)).toHaveLength(2)
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(1)
    await wrapper.setProps({ collapse: false })
    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(wrapper.find(".schemx-search-collapse").exists()).toBe(false)
    wrapper.unmount()
  })

  it("支持非受控初始展开，只有一行或空列表时不显示触发器", async () => {
    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(Search, {
      props: {
        rendererRegistry,
        schemas: fields([24, 24]),
        collapse: { defaultCollapsed: false },
      },
    })

    await flushPromises()

    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("收起")
    expect(wrapper.get<HTMLElement>(".schemx-search-toggle").element.style.display).toBe(
      ""
    )
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(1)
    wrapper.unmount()
    // 内容恰好一行的搜索组件。
    const single = mount(Search, {
      props: { rendererRegistry, schemas: fields([8, 8, 8]) },
    })

    await flushPromises()

    expect(single.findAll("input")).toHaveLength(3)
    expect(single.find(".schemx-search-collapse").exists()).toBe(false)
    expect(single.get<HTMLElement>(".schemx-search-toggle").element.style.display).toBe(
      "none"
    )
    expect(single.get(".schemx-search-toggle").attributes("inert")).toBeDefined()
    single.unmount()
    // 无字段且关闭操作按钮的搜索组件。
    const empty = mount(Search, { props: { submitter: false, resetter: false } })

    await flushPromises()

    expect(empty.find(".schemx-search-collapse").exists()).toBe(false)
    expect(empty.find(".schemx-actions").exists()).toBe(false)
    empty.unmount()
  })

  it("折叠配置支持布尔开关、动态文案和初始值只读取一次", async () => {
    // 禁用时挂载全部字段，重新启用后使用初始折叠状态。
    const wrapper = mount(Search, {
      props: { rendererRegistry, schemas: fields([24, 24]), collapse: false },
    })

    await flushPromises()

    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(wrapper.find(".schemx-search-collapse").exists()).toBe(false)
    await wrapper.setProps({ collapse: true })
    expect(visibleInputs(wrapper)).toHaveLength(1)
    await wrapper.setProps({
      collapse: {
        defaultCollapsed: false,
        expandText: "更多条件",
        collapseText: "精简条件",
      },
    })
    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("更多条件")
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("精简条件")
    await wrapper.setProps({
      collapse: { expandText: "展开条件", collapseText: "收起条件" },
    })
    expect(wrapper.get(".schemx-search-collapse").text()).toBe("收起条件")
    wrapper.unmount()
  })

  it("折叠按钮透传外观属性，并保留 Search 管理的点击与原生行为", async () => {
    // 非类型化输入中的点击和原生提交行为也不能覆盖折叠操作。
    const onClick = vi.fn()

    // 模拟来自 JavaScript 配置的额外行为属性。
    const buttonProps = {
      type: "primary" as const,
      size: "small" as const,
      class: "custom-collapse-style",
      style: { color: "red" },
      nativeType: "submit" as const,
      "native-type": "reset",
      onClick,
    }

    // 展示两个独占一行的字段，便于验证按钮仍可切换可见范围。
    const wrapper = mount(Search, {
      props: {
        rendererRegistry,
        schemas: fields([24, 24]),
        collapse: { buttonProps },
      },
    })

    await flushPromises()

    expect(wrapper.get(".schemx-search-collapse").classes()).toContain(
      "custom-collapse-style"
    )
    expect(wrapper.get(".schemx-search-collapse").attributes("style")).toContain(
      "color: red"
    )
    expect(wrapper.get(".schemx-search-collapse").attributes("type")).toBe("button")
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(onClick).not.toHaveBeenCalled()
    await wrapper.setProps({
      collapse: { buttonProps: { disabled: true, style: { color: "blue" } } },
    })
    expect(wrapper.get(".schemx-search-collapse").attributes("style")).toContain(
      "color: blue"
    )
    expect(wrapper.get(".schemx-search-collapse").attributes("disabled")).toBeDefined()
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(2)
    wrapper.unmount()
  })

  it("auto 根据实际换行折叠，缩放后保留用户状态且不重复挂载", async () => {
    // 布局变化不能冒充用户切换。
    const onCollapsedChange = vi.fn()

    // 三个 220px 的自动列在 600px 容器中排成两行。
    const wrapper = mount(Search, {
      props: {
        rendererRegistry,
        col: "auto",
        schemas: fields([24, 24, 24]).map(
          // field 去除字段自己的栅格，改为继承表单级 auto。
          (field) => ({ ...field, col: undefined })
        ),
        collapse: { onCollapsedChange },
      },
    })

    await flushPromises()
    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(wrapper.findAll("input")).toHaveLength(3)
    expect(wrapper.get("[inert].schemx-col").attributes("aria-hidden")).toBe("true")
    geometry.resize(400)
    await vi.waitFor(() => expect(visibleInputs(wrapper)).toHaveLength(1))
    geometry.resize(900)
    await vi.waitFor(() => expect(visibleInputs(wrapper)).toHaveLength(3))
    expect(wrapper.find(".schemx-search-collapse").exists()).toBe(false)
    geometry.resize(600)
    await vi.waitFor(() => expect(visibleInputs(wrapper)).toHaveLength(2))
    expect(onCollapsedChange).not.toHaveBeenCalled()
    await wrapper.get(".schemx-search-collapse").trigger("click")
    geometry.resize(400)
    await vi.waitFor(() => expect(visibleInputs(wrapper)).toHaveLength(3))
    expect(wrapper.find("[inert].schemx-col").exists()).toBe(false)
    expect(wrapper.get<HTMLElement>(".schemx-search-toggle").element.style.display).toBe(
      ""
    )
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect(mountedFields).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it("auto 与栅格混排、字段显隐和禁用 collapse 共用实测布局", async () => {
    // auto 220px 加半行栅格 300px 可以同处第一行。
    const schemas: SchemxField<Values>[] = [
      { name: "first", label: "首项", componentType: "input", col: "auto" },
      { name: "middle", label: "中项", componentType: "input", col: { span: 12 } },
      { name: "last", label: "末项", componentType: "input", col: "auto" },
    ]

    // 使用真实 Field 路径验证折叠不改写 visible。
    const wrapper = mount(Search, { props: { rendererRegistry, schemas } })

    await flushPromises()
    expect(visibleInputs(wrapper)).toHaveLength(2)
    await wrapper.setProps({
      schemas: schemas.map(
        // schema 是根级条件，index 只用于隐藏中间一项。
        (schema, index) => (index === 1 ? { ...schema, visible: false } : schema)
      ),
    })
    await vi.waitFor(() =>
      expect(wrapper.find(".schemx-search-collapse").exists()).toBe(false)
    )
    expect(wrapper.findAll("input")).toHaveLength(2)
    await wrapper.setProps({ schemas, collapse: false })
    await flushPromises()
    expect(visibleInputs(wrapper)).toHaveLength(3)
    await wrapper.setProps({ collapse: true })
    expect(visibleInputs(wrapper)).toHaveLength(2)
    wrapper.unmount()
  })

  it("折叠不丢失字段值，查询与重置仍处理完整条件", async () => {
    // 记录查询回调收到的完整条件。
    const onFinish = vi.fn()

    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(Search, {
      props: {
        rendererRegistry,
        schemas: fields([24, 24]),
        modelValue: { field0: "A", field1: "B" },
        onFinish,
      },
    })

    await flushPromises()

    await wrapper.get(".schemx-search-collapse").trigger("click")
    await visibleInputs(wrapper)[1]?.setValue("changed")
    await flushPromises()
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      { field0: "A", field1: "changed" },
    ])
    await wrapper.get(".schemx-search-collapse").trigger("click")
    await wrapper.get(".schemx-actions-button--submit").trigger("click")
    await flushPromises()
    expect(onFinish).toHaveBeenCalledWith({ field0: "A", field1: "changed" })
    await wrapper.get(".schemx-actions-button--reset").trigger("click")
    await wrapper.get(".schemx-search-collapse").trigger("click")
    await flushPromises()
    expect(visibleInputs(wrapper)[1]?.element.value).toBe("B")
    wrapper.unmount()
  })

  it("折叠字段仍参与校验，外部实例不由 Search 销毁", async () => {
    // 当前搜索组件使用的表单实例。
    const form = createForm<Values>({
      rendererRegistry,
      schemas: [
        { name: "first", label: "首项", componentType: "input", col: { span: 24 } },
        {
          name: "second",
          label: "后项",
          componentType: "input",
          col: { span: 24 },
          required: true,
        },
      ],
    })

    // 验证外部实例的销毁权仍属于调用方。
    const destroy = vi.spyOn(form, "destroy")

    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(Search, { props: { form } })

    await flushPromises()

    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect((await form.validate()).valid).toBe(false)
    expect(form.getFieldErrors("second").length).toBeGreaterThan(0)
    await wrapper.get(".schemx-search-collapse").trigger("click")
    expect(
      wrapper.findAll(".schemx-field__error").some((error) => error.text().length > 0)
    ).toBe(true)
    wrapper.unmount()
    expect(destroy).not.toHaveBeenCalled()
    form.destroy()
  })

  it("折叠插槽和字段插槽分别生效，按钮关闭后仍可展开", async () => {
    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(Search, {
      props: {
        rendererRegistry,
        schemas: fields([24, 24]),
        submitter: false,
        resetter: false,
      },
      slots: {
        // toggle 切换搜索区，collapsed 决定自定义按钮文案。
        collapse: ({ toggle, collapsed }) =>
          h("button", { class: "custom-collapse", onClick: toggle }, String(collapsed)),
        field0Label: () => "自定义条件",
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain("自定义条件")
    expect(wrapper.get(".custom-collapse").text()).toBe("true")
    expect(wrapper.findAll("button")).toHaveLength(1)
    await wrapper.get(".custom-collapse").trigger("click")
    expect(wrapper.get<HTMLElement>(".schemx-search-toggle").element.style.display).toBe(
      ""
    )
    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(wrapper.get(".custom-collapse").text()).toBe("false")
    await wrapper.get(".custom-collapse").trigger("click")
    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect(wrapper.get(".custom-collapse").text()).toBe("true")
    wrapper.unmount()
  })

  it("auto 仅一行时可直接定位后续条件，无需请求展开", async () => {
    // 提供浏览器可见布局，验证字段注册表能直接找到自动展示的后续字段。
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      0: new DOMRect(),
      length: 1,
      item: () => new DOMRect(),
      [Symbol.iterator]: () => [new DOMRect()][Symbol.iterator](),
    })
    // 外部通过公开组件 ref 使用定位 API。
    const form = ref<SchemxInstance>()

    // 自动展示不应向受控状态发出展开请求。
    const onCollapsedChange = vi.fn()

    // 当前测试宿主中所有条件都使用自然宽度。
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(SchemxSearch, {
              ref: form,
              rendererRegistry,
              col: "auto",
              collapse: { collapsed: true, onCollapsedChange },
              schemas: [
                { name: "first", label: "首项", componentType: "input" },
                { name: "last", label: "后项", componentType: "input" },
              ],
            })
        },
      }),
      { attachTo: document.body }
    )

    await flushPromises()

    expect(await form.value?.scrollToField("last")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()
    expect(onCollapsedChange).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it("通过 scrollToField 展开搜索区后定位，拒绝受控更新时返回 false", async () => {
    // 模拟浏览器中的可见布局。
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      0: new DOMRect(),
      length: 1,
      item: () => new DOMRect(),
      [Symbol.iterator]: () => [new DOMRect()][Symbol.iterator](),
    })
    // 当前搜索组件使用的表单实例。
    const form = ref<SchemxInstance>()

    // 当前测试提供的受控折叠状态。
    const collapsed = ref<boolean | undefined>(undefined)

    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(SchemxSearch, {
              ref: form,
              rendererRegistry,
              schemas: fields([24, 24]),
              collapse: { collapsed: collapsed.value },
            })
        },
      }),
      { attachTo: document.body }
    )

    await flushPromises()

    expect(await form.value?.scrollToField("field1")).toBe(true)
    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()
    collapsed.value = true
    await flushPromises()
    expect(await form.value?.scrollToField("missing")).toBe(false)
    expect(await form.value?.scrollToField("field1")).toBe(false)
    expect(visibleInputs(wrapper)).toHaveLength(1)
    wrapper.unmount()
  })

  it("定位会依次展开 Search 和已挂载的折叠 Group，受控接受更新后也可定位", async () => {
    // 为真实字段注册提供可见布局。
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      0: new DOMRect(),
      length: 1,
      item: () => new DOMRect(),
      [Symbol.iterator]: () => [new DOMRect()][Symbol.iterator](),
    })
    // form 是 Search 暴露的完整控制 API。
    const form = ref<SchemxInstance>()

    // 双向绑定模拟业务组件接受 Search 的展开请求。
    const collapsed = ref(true)

    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(SchemxSearch, {
              ref: form,
              rendererRegistry,
              collapse: {
                collapsed: collapsed.value,
                // next 是 Search 请求的折叠状态。
                onCollapsedChange: (next) => {
                  collapsed.value = next
                },
              },
              schemas: [
                {
                  name: "first",
                  label: "首项",
                  componentType: "input",
                  col: { span: 24 },
                },
                {
                  key: "advanced",
                  label: "高级条件",
                  collapsible: true,
                  defaultCollapsed: true,
                  destroyOnCollapse: true,
                  children: [
                    { name: "nested", label: "高级字段", componentType: "input" },
                  ],
                },
              ],
            })
        },
      }),
      { attachTo: document.body }
    )

    await flushPromises()

    expect(visibleInputs(wrapper)).toHaveLength(1)
    expect(await form.value?.scrollToField("nested")).toBe(true)
    expect(collapsed.value).toBe(false)
    expect(visibleInputs(wrapper)).toHaveLength(2)
    wrapper.unmount()
  })

  it("绑定的创建器提供独立配置，插件注册 Search 且保留 Form", async () => {
    // 为绑定组件提供独立配置的工厂。
    const api = createSchemx({
      rendererRegistry,
      schemaConfig: { col: { span: 12 }, labelWidth: 123 },
    })

    // 记录 Search 创建内部实例的次数。
    const create = vi.spyOn(api, "createForm")

    // 绑定当前工厂的可安装 Search 定义。
    const BoundSearch = createSearchComponent(api.createForm, "BoundSearch")

    // 当前测试挂载的 Search 宿主。
    const wrapper = mount(BoundSearch, { props: { schemas: fields([12, 12, 12]) } })

    await flushPromises()

    expect(create).toHaveBeenCalledOnce()
    expect(visibleInputs(wrapper)).toHaveLength(2)
    expect(wrapper.get(".schemx-field__label").attributes("style")).toContain("123px")
    // 验证 Search 和 Form 注册可以并存的 Vue App。
    const app = createApp({})

    app.component("SchemxForm", defineComponent({ render: () => h("div") }))
    // 安装 Search 之前注册的 Form 定义。
    const Form = app.component("SchemxForm")

    app.use(BoundSearch)
    expect(app.component("SchemxSearch")).toBe(BoundSearch)
    expect(app.component("SchemxForm")).toBe(Form)
    wrapper.unmount()
  })
})
