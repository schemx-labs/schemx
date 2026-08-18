/**
 * SchemxForm 内置提交与重置操作区测试。
 *
 * @module vue/__tests__/formActions
 */

import { h, nextTick } from "vue"

import { createForm, type Values } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { describe, expect, it, vi } from "vitest"

import SchemxForm from "../form.vue"

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

/**
 * 等待提交流程进入异步 onFinish 阶段。
 */
async function waitForSubmitStart(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe("SchemxForm actions", () => {
  it("默认渲染操作区，并支持显式配置文本", () => {
    const defaultWrapper = mount(SchemxForm)

    expect(defaultWrapper.find(".schemx-actions").exists()).toBe(true)

    defaultWrapper.unmount()

    const visibleWrapper = mount(SchemxForm, {
      props: {
        submitter: { text: "保存" },
        resetter: true,
      },
    })

    expect(visibleWrapper.get(".schemx-actions-button--submit").text()).toBe("保存")
    expect(visibleWrapper.get(".schemx-actions-button--reset").text()).toBe("重置")

    visibleWrapper.unmount()
  })

  it("提交按钮跟随异步 onFinish 的 loading，并在期间禁用两个按钮", async () => {
    const deferred = createDeferred()

    const onLoadingChange = vi.fn()

    const wrapper = mount(SchemxForm, {
      props: {
        initialValues: { name: "Ada" },
        submitter: true,
        resetter: true,
        onFinish: () => deferred.promise,
        onLoadingChange,
      },
    })

    await wrapper.get(".schemx-actions-button--submit").trigger("click")
    await waitForSubmitStart()

    expect(wrapper.get(".schemx-actions-button--submit").attributes("aria-busy")).toBe(
      "true"
    )
    expect(
      wrapper.get(".schemx-actions-button--submit").attributes("disabled")
    ).toBeDefined()
    expect(
      wrapper.get(".schemx-actions-button--reset").attributes("disabled")
    ).toBeDefined()
    expect(onLoadingChange.mock.calls).toEqual([[true]])

    deferred.resolve()
    await waitForSubmitStart()

    expect(
      wrapper.get(".schemx-actions-button--submit").attributes("aria-busy")
    ).toBeUndefined()
    expect(onLoadingChange.mock.calls).toEqual([[true], [false]])

    wrapper.unmount()
  })

  it("重置按钮调用外部 Form，但不向实例追加组件回调", async () => {
    const externalOnReset = vi.fn()

    const componentOnReset = vi.fn()

    const form = createForm<Values>({
      initialValues: { name: "Ada" },
      onReset: externalOnReset,
    })

    const wrapper = mount(SchemxForm, {
      props: {
        form,
        resetter: true,
        onReset: componentOnReset,
      },
    })

    form.setFieldValue("name", "Grace")
    await wrapper.get(".schemx-actions-button--reset").trigger("click")

    expect(form.getFieldValue("name")).toBe("Ada")
    expect(externalOnReset).toHaveBeenCalledTimes(1)
    expect(componentOnReset).not.toHaveBeenCalled()

    wrapper.unmount()
    form.destroy()
  })

  it("受控 loading 覆盖操作区展示并禁用两个按钮", () => {
    const wrapper = mount(SchemxForm, {
      props: {
        loading: true,
        submitter: true,
        resetter: true,
      },
    })

    expect(wrapper.get(".schemx-actions-button--submit").attributes("aria-busy")).toBe(
      "true"
    )
    expect(
      wrapper.get(".schemx-actions-button--submit").attributes("disabled")
    ).toBeDefined()
    expect(
      wrapper.get(".schemx-actions-button--reset").attributes("disabled")
    ).toBeDefined()

    wrapper.unmount()
  })

  it("外部 Form 的 loading 回调不由组件 Props 追加", async () => {
    const deferred = createDeferred()

    const externalOnLoadingChange = vi.fn()

    const componentOnLoadingChange = vi.fn()

    const form = createForm<Values>({
      initialValues: { name: "Ada" },
      onFinish: () => deferred.promise,
      onLoadingChange: externalOnLoadingChange,
    })

    const wrapper = mount(SchemxForm, {
      props: {
        form,
        submitter: true,
        onLoadingChange: componentOnLoadingChange,
      },
    })

    await wrapper.get(".schemx-actions-button--submit").trigger("click")
    await waitForSubmitStart()

    expect(externalOnLoadingChange.mock.calls).toEqual([[true]])
    expect(componentOnLoadingChange).not.toHaveBeenCalled()

    deferred.resolve()
    await waitForSubmitStart()

    expect(externalOnLoadingChange.mock.calls).toEqual([[true], [false]])

    wrapper.unmount()
    form.destroy()
  })

  it("操作插槽替换原生按钮并接收 loading 状态", () => {
    const wrapper = mount(SchemxForm, {
      props: { resetter: false },
      slots: {
        submitter: ({ loading }: { loading: boolean }) =>
          h("button", { "data-testid": "custom-submitter" }, String(loading)),
      },
    })

    expect(wrapper.find(".schemx-actions-button--submit").exists()).toBe(false)
    expect(wrapper.get('[data-testid="custom-submitter"]').text()).toBe("false")

    wrapper.unmount()
  })
})
