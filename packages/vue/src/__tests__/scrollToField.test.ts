/* eslint-disable vue/one-component-per-file, vue/require-default-prop */
import { defineComponent, h, markRaw, nextTick, ref } from "vue"

import { createFieldKey, createForm, createRendererRegistry } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { provideFieldScrollRegistry } from "../context/fieldScrollContext"
import SchemxForm from "../form.vue"
import { useFieldScrollTarget } from "../hooks/useFieldScrollTarget"

import type { FieldScrollRegistry } from "../context/fieldScrollContext"
import type { FieldScrollTargetRef } from "../hooks/useFieldScrollTarget"
import type { SchemxInstance } from "../index"
import type { NamePath, Values } from "@schemx/core"

const { scrollIntoViewMock } = vi.hoisted(() => ({
  scrollIntoViewMock: vi.fn(),
}))

vi.mock("scroll-into-view-if-needed", () => ({
  default: scrollIntoViewMock,
}))

const InputRenderer = defineComponent({
  name: "ScrollTargetInput",
  setup() {
    return () => h("input")
  },
})

interface FormValues {
  name: string
}

interface DynamicFormValues {
  users: Array<{
    name: string
  }>
}

function createInputRendererRegistry() {
  const rendererRegistry = createRendererRegistry()

  rendererRegistry.register("input", markRaw(InputRenderer))

  return rendererRegistry
}

function markVisible(element: Element): void {
  vi.spyOn(element, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList)
}

function stubVisibleLayout(): void {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
    length: 1,
  } as DOMRectList)
}

describe("Schemx scrollToField", () => {
  beforeEach(() => {
    scrollIntoViewMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("keeps array path segment boundaries in field identities", () => {
    expect(createFieldKey(["user.name"] as never)).not.toBe(
      createFieldKey("user.name" as never)
    )
  })

  it("defaults to smooth centered scrolling and accepts explicit options", async () => {
    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [{ name: "name", label: "姓名", componentType: "input" }],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<FormValues>

    const target = wrapper.get(".schemx-field-wrapper").element

    markVisible(target)

    expect(await form.scrollToField("name")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(target, {
      behavior: "smooth",
      block: "center",
      inline: "nearest",
      scrollMode: "if-needed",
    })

    expect(await form.scrollToField("name", { behavior: "auto", block: "end" })).toBe(
      true
    )
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(target, {
      behavior: "auto",
      block: "end",
      inline: "nearest",
      scrollMode: "if-needed",
    })

    expect(await form.scrollToField("missing" as never)).toBe(false)

    wrapper.unmount()
  })

  it("updates the registered target when a field path changes", async () => {
    const registeredElements = new Map<string, Set<HTMLElement>>()

    const registry: FieldScrollRegistry = {
      register(key, element) {
        let elements = registeredElements.get(key)

        if (!elements) {
          elements = new Set()
          registeredElements.set(key, elements)
        }

        elements.add(element)

        return () => {
          elements?.delete(element)

          if (elements?.size === 0) {
            registeredElements.delete(key)
          }
        }
      },
      find(key) {
        return registeredElements.get(key)?.values().next().value
      },
      registerGroup() {
        return () => {}
      },
      getGroup() {
        return undefined
      },
      getGroupCollapsed() {
        return undefined
      },
    }

    const name = ref<NamePath<Values>>("name")

    let setTarget: FieldScrollTargetRef | undefined

    const Target = defineComponent({
      setup() {
        setTarget = useFieldScrollTarget({ getName: () => name.value })

        return () => h("div")
      },
    })

    const TargetFixture = defineComponent({
      setup() {
        provideFieldScrollRegistry(registry)

        return () => h(Target)
      },
    })

    const wrapper = mount(TargetFixture)

    const target = document.createElement("div")

    if (!setTarget) {
      throw new Error("Field scroll target ref was not registered")
    }

    setTarget(target)

    expect(registry.find(createFieldKey("name"))).toBe(target)

    name.value = "alias"
    await nextTick()

    expect(registry.find(createFieldKey("name"))).toBeUndefined()
    expect(registry.find(createFieldKey("alias"))).toBe(target)

    wrapper.unmount()

    expect(registry.find(createFieldKey("alias"))).toBeUndefined()
  })

  it("scrolls to dynamic array fields using their current field path", async () => {
    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        initialValues: { users: [{ name: "Ada" }] },
        schemas: [
          {
            key: "users-schema",
            name: "users",
            label: "用户",
            item: [{ name: "name", label: "姓名", componentType: "input" }],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<DynamicFormValues>

    const target = wrapper.get(".schemx-field-wrapper").element

    markVisible(target)

    expect(await form.scrollToField("users.0.name")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ scrollMode: "if-needed" })
    )

    wrapper.unmount()
  })

  it("scrolls to a field in an already expanded Group", async () => {
    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [
          {
            key: "profile",
            label: "资料",
            children: [{ name: "name", label: "姓名", componentType: "input" }],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<FormValues>

    const target = wrapper.get(".schemx-field-wrapper").element

    markVisible(target)

    expect(await form.scrollToField("name")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(target, expect.any(Object))

    wrapper.unmount()
  })

  it("expands a Group before scrolling when destroyOnCollapse unmounts its fields", async () => {
    stubVisibleLayout()

    const onCollapsedChange = vi.fn()

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [
          {
            key: "profile",
            label: "资料",
            collapsible: true,
            defaultCollapsed: true,
            onCollapsedChange,
            children: [{ name: "name", label: "姓名", componentType: "input" }],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<FormValues>

    expect(wrapper.find(".schemx-field-wrapper").exists()).toBe(false)
    expect(await form.scrollToField("name")).toBe(true)
    expect(onCollapsedChange).toHaveBeenCalledTimes(1)
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(wrapper.find(".schemx-group--collapsed").exists()).toBe(false)
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it("reveals a retained field when destroyOnCollapse is false", async () => {
    const onCollapsedChange = vi.fn()

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [
          {
            key: "profile",
            label: "资料",
            collapsible: true,
            defaultCollapsed: true,
            destroyOnCollapse: false,
            onCollapsedChange,
            children: [{ name: "name", label: "姓名", componentType: "input" }],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<FormValues>

    const target = wrapper.get(".schemx-field-wrapper").element

    markVisible(target)

    expect(await form.scrollToField("name")).toBe(true)
    expect(onCollapsedChange).toHaveBeenCalledTimes(1)
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(wrapper.get(".schemx-group__body").attributes("style")).toBeUndefined()
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(target, expect.any(Object))

    wrapper.unmount()
  })

  it("expands nested Groups from outer to inner before scrolling", async () => {
    stubVisibleLayout()

    const expansionOrder: string[] = []

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [
          {
            key: "outer",
            label: "外层",
            collapsible: true,
            defaultCollapsed: true,
            onCollapsedChange: (collapsed: boolean) => {
              expansionOrder.push(`outer:${collapsed}`)
            },
            children: [
              {
                key: "inner",
                label: "内层",
                collapsible: true,
                defaultCollapsed: true,
                onCollapsedChange: (collapsed: boolean) => {
                  expansionOrder.push(`inner:${collapsed}`)
                },
                children: [{ name: "name", label: "姓名", componentType: "input" }],
              },
            ],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<FormValues>

    expect(await form.scrollToField("name")).toBe(true)
    expect(expansionOrder).toEqual(["outer:false", "inner:false"])
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it("expands a Group inside a Dynamic row using the indexed field path", async () => {
    stubVisibleLayout()

    const onCollapsedChange = vi.fn()

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        initialValues: { users: [{ name: "Ada" }] },
        schemas: [
          {
            key: "users-schema",
            name: "users",
            label: "用户",
            item: [
              {
                key: "profile",
                label: "资料",
                collapsible: true,
                defaultCollapsed: true,
                onCollapsedChange,
                children: [{ name: "name", label: "姓名", componentType: "input" }],
              },
            ],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<DynamicFormValues>

    expect(await form.scrollToField("users.0.name")).toBe(true)
    expect(onCollapsedChange).toHaveBeenCalledTimes(1)
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it("returns false when a controlled Group refuses the expand request", async () => {
    const onCollapsedChange = vi.fn()

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [
          {
            key: "profile",
            label: "资料",
            collapsible: true,
            collapsed: true,
            onCollapsedChange,
            children: [{ name: "name", label: "姓名", componentType: "input" }],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<FormValues>

    expect(await form.scrollToField("name")).toBe(false)
    expect(onCollapsedChange).toHaveBeenCalledTimes(1)
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(scrollIntoViewMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it("scrolls after a controlled Group accepts the expand request in one update", async () => {
    stubVisibleLayout()

    const collapsed = ref(true)

    const formRef = ref<SchemxInstance<FormValues>>()

    const onCollapsedChange = vi.fn((nextCollapsed: boolean) => {
      collapsed.value = nextCollapsed
      formRef.value?.setSchemas([
        {
          key: "profile",
          label: "资料",
          collapsible: true,
          collapsed: nextCollapsed,
          onCollapsedChange,
          children: [{ name: "name", label: "姓名", componentType: "input" }],
        },
      ])
    })

    const rendererRegistry = createInputRendererRegistry()

    const ControlledForm = defineComponent({
      setup() {
        return () =>
          h(SchemxForm, {
            ref: formRef,
            rendererRegistry,
            schemas: [
              {
                key: "profile",
                label: "资料",
                collapsible: true,
                collapsed: collapsed.value,
                onCollapsedChange,
                children: [{ name: "name", label: "姓名", componentType: "input" }],
              },
            ],
          })
      },
    })

    const wrapper = mount(ControlledForm, { attachTo: document.body })

    const form = formRef.value

    if (!form) {
      throw new Error("Schemx form ref was not assigned")
    }

    const result = await form.scrollToField("name")

    expect(collapsed.value).toBe(false)
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(form.getViewSchemas()[0]).toMatchObject({ collapsed: false })
    expect(wrapper.find(".schemx-group--collapsed").exists()).toBe(false)
    expect(wrapper.find(".schemx-field-wrapper").exists()).toBe(true)
    expect(result).toBe(true)
    expect(onCollapsedChange).toHaveBeenCalledTimes(1)
    expect(onCollapsedChange).toHaveBeenCalledWith(false)
    expect(scrollIntoViewMock).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it("returns false for disabled, non-collapsible, or invisible collapsed Groups", async () => {
    const disabledChange = vi.fn()

    const invisibleChange = vi.fn()

    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [
          {
            key: "disabled-group",
            label: "禁用组",
            collapsible: true,
            disabled: true,
            defaultCollapsed: true,
            onCollapsedChange: disabledChange,
            children: [
              { name: "disabledField", label: "禁用字段", componentType: "input" },
            ],
          },
          {
            key: "static-collapsed-group",
            label: "不可折叠组",
            defaultCollapsed: true,
            children: [{ name: "staticField", label: "字段", componentType: "input" }],
          },
          {
            key: "invisible-group",
            label: "隐藏组",
            collapsible: true,
            defaultCollapsed: true,
            visible: false,
            onCollapsedChange: invisibleChange,
            children: [
              { name: "invisibleField", label: "隐藏字段", componentType: "input" },
            ],
          },
        ],
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<{
      disabledField: string
      staticField: string
      invisibleField: string
    }>

    expect(await form.scrollToField("disabledField")).toBe(false)
    expect(await form.scrollToField("staticField")).toBe(false)
    expect(await form.scrollToField("invisibleField")).toBe(false)
    expect(disabledChange).not.toHaveBeenCalled()
    expect(invisibleChange).not.toHaveBeenCalled()
    expect(scrollIntoViewMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it("returns false when Group Content does not render the target field", async () => {
    const wrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [
          {
            key: "profile",
            label: "资料",
            collapsible: true,
            defaultCollapsed: true,
            children: [{ name: "name", label: "姓名", componentType: "input" }],
          },
        ],
      },
      slots: {
        profileContent: () => h("div", { "data-testid": "custom-content" }),
      },
      attachTo: document.body,
    })

    const form = wrapper.vm as unknown as SchemxInstance<FormValues>

    expect(await form.scrollToField("name")).toBe(false)
    expect(wrapper.find(".schemx-group--collapsed").exists()).toBe(false)
    expect(scrollIntoViewMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it("keeps scroll registries isolated and restores the prior handler after unmount", async () => {
    const rendererRegistry = createInputRendererRegistry()

    const sharedForm = createForm<Values>({
      rendererRegistry,
      initialValues: { name: "Ada" },
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    })

    const props = {
      form: sharedForm,
      rendererRegistry,
      schemas: [{ name: "name", label: "姓名", componentType: "input" }],
    }

    const firstWrapper = mount(SchemxForm, { props, attachTo: document.body })

    const firstForm = firstWrapper.vm as unknown as SchemxInstance<FormValues>

    const firstTarget = firstWrapper.get(".schemx-field-wrapper").element

    markVisible(firstTarget)

    expect(await firstForm.scrollToField("name")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(firstTarget, expect.any(Object))

    const secondWrapper = mount(SchemxForm, { props, attachTo: document.body })

    const secondForm = secondWrapper.vm as unknown as SchemxInstance<FormValues>

    const secondTarget = secondWrapper.get(".schemx-field-wrapper").element

    markVisible(secondTarget)

    expect(await secondForm.scrollToField("name")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(secondTarget, expect.any(Object))

    secondWrapper.unmount()

    expect(await firstForm.scrollToField("name")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(firstTarget, expect.any(Object))

    firstWrapper.unmount()
    sharedForm.destroy()
  })

  it("keeps independent form registries isolated", async () => {
    const firstWrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [{ name: "first", label: "First", componentType: "input" }],
      },
      attachTo: document.body,
    })

    const secondWrapper = mount(SchemxForm, {
      props: {
        rendererRegistry: createInputRendererRegistry(),
        schemas: [{ name: "second", label: "Second", componentType: "input" }],
      },
      attachTo: document.body,
    })

    const firstForm = firstWrapper.vm as unknown as SchemxInstance<{ first: string }>

    const secondForm = secondWrapper.vm as unknown as SchemxInstance<{ second: string }>

    const firstTarget = firstWrapper.get(".schemx-field-wrapper").element

    const secondTarget = secondWrapper.get(".schemx-field-wrapper").element

    markVisible(firstTarget)
    markVisible(secondTarget)

    expect(await firstForm.scrollToField("first")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(firstTarget, expect.any(Object))
    expect(await secondForm.scrollToField("second")).toBe(true)
    expect(scrollIntoViewMock).toHaveBeenLastCalledWith(secondTarget, expect.any(Object))

    firstWrapper.unmount()
    secondWrapper.unmount()
  })
})
