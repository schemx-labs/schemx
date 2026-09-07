/**
 * useDictionary Hook 测试
 *
 * 验证 api 函数模式下的字典选项加载行为：
 * loading/error 状态、竞态控制、重试、mutate、refresh 等。
 *
 * @module hooks/__tests__/useDictionary
 */

import { defineComponent, h, nextTick } from "vue"

import { createForm } from "@schemx/core"
import { mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SchemxDictionary } from "@/types/dictionary"

import { SCHEMX_FORM_INSTANCE_KEY } from "../provideFormContext"
import { normalizeError, useDictionary, type UseDictionaryReturn } from "../useDictionary"

// ========== normalizeError 单元测试 ==========

describe("normalizeError", () => {
  it("传入 Error 实例时返回同一实例", () => {
    const err = new Error("test error")

    expect(normalizeError(err)).toBe(err)
  })

  it("将字符串包装为 Error", () => {
    const result = normalizeError("something went wrong")

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("something went wrong")
  })

  it("将数字包装为 Error", () => {
    const result = normalizeError(404)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe("404")
  })

  it("将 null 包装为 Error", () => {
    expect(normalizeError(null).message).toBe("null")
  })

  it("将 undefined 包装为 Error", () => {
    expect(normalizeError(undefined).message).toBe("undefined")
  })
})

// ========== 辅助函数 ==========

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * 挂载包装组件，提供 inject 上下文，在 setup 中调用 useDictionary。
 */
interface DictionaryValues {
  country?: string
  city?: string
}

function mountUseDictionary(
  options: SchemxDictionary<DictionaryValues>,
  fieldName?: keyof DictionaryValues
) {
  let hookReturn: UseDictionaryReturn

  const form = createForm<DictionaryValues>({ initialValues: {} })

  const Comp = defineComponent({
    setup() {
      hookReturn = useDictionary(options, fieldName)

      return () => h("div")
    },
  })

  const wrapper = mount(Comp, {
    global: {
      provide: {
        [SCHEMX_FORM_INSTANCE_KEY]: form,
      },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return { wrapper, hookReturn: hookReturn!, form }
}

// ========== useDictionary 集成测试 ==========

describe("useDictionary 集成测试", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("依赖字段变化时将最新表单快照传给 onDepsChange", async () => {
    const onDepsChange = vi.fn()

    const { wrapper, form } = mountUseDictionary({
      api: vi.fn().mockResolvedValue([]),
      dependsOn: ["country"],
      onDepsChange,
    })

    form.setFieldValue("country", "CN")
    await nextTick()

    expect(onDepsChange).toHaveBeenCalledWith({ country: "CN" }, expect.anything())

    wrapper.unmount()
  })

  it("非依赖字段变化不会重新加载或重置当前字段", async () => {
    const api = vi.fn().mockResolvedValue([])

    const { wrapper, form } = mountUseDictionary(
      {
        api,
        dependsOn: ["country"],
        immediate: false,
        resetOnDepsChange: true,
      },
      "city"
    )

    form.setFieldValue("country", "CN")
    await flushPromises()
    api.mockClear()

    form.setFieldValue("city", "Shenzhen")
    await flushPromises()

    expect(api).not.toHaveBeenCalled()
    expect(form.getFieldValue("city")).toBe("Shenzhen")

    wrapper.unmount()
  })

  // --- Loading 状态 ---

  describe("Loading 状态", () => {
    it("api 执行期间 loading 为 true，完成后为 false", async () => {
      let resolveApi: (value: any) => void

      const mockApi = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveApi = resolve
          })
      )

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      expect(hookReturn.loading.value).toBe(true)

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      resolveApi!([{ label: "A", value: 1 }])
      await flushPromises()
      await nextTick()

      expect(hookReturn.loading.value).toBe(false)
      expect(hookReturn.list.value).toEqual([{ label: "A", value: 1 }])

      wrapper.unmount()
    })

    it("api 失败后 loading 为 false", async () => {
      const mockApi = vi.fn().mockRejectedValue(new Error("fail"))

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.loading.value).toBe(false)

      wrapper.unmount()
    })
  })

  // --- Error 状态 ---

  describe("Error 状态", () => {
    it("api 成功后 error 为 undefined", async () => {
      const mockApi = vi.fn().mockResolvedValue([{ label: "A", value: 1 }])

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.error.value).toBeUndefined()
      expect(hookReturn.list.value).toEqual([{ label: "A", value: 1 }])

      wrapper.unmount()
    })

    it("api 失败后 error 为 Error 实例", async () => {
      const mockApi = vi.fn().mockRejectedValue(new Error("server error"))

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.error.value).toBeInstanceOf(Error)
      expect(hookReturn.error.value?.message).toBe("server error")

      wrapper.unmount()
    })

    it("后续成功后 error 重置为 undefined", async () => {
      let callCount = 0

      const mockApi = vi.fn(() => {
        callCount++
        if (callCount === 1) return Promise.reject(new Error("first fail"))

        return Promise.resolve([{ label: "B", value: 2 }])
      })

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.error.value).toBeInstanceOf(Error)

      await hookReturn.loadDict()
      await nextTick()

      expect(hookReturn.error.value).toBeUndefined()
      expect(hookReturn.list.value).toEqual([{ label: "B", value: 2 }])

      wrapper.unmount()
    })
  })

  // --- 竞态控制 ---

  describe("竞态控制", () => {
    it("并发调用时仅保留最后一个响应", async () => {
      const resolvers: Array<(value: any) => void> = []

      const mockApi = vi.fn(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve)
          })
      )

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      hookReturn.loadDict()
      await nextTick()
      hookReturn.loadDict()
      await nextTick()

      expect(resolvers.length).toBe(3)

      // 乱序解析：先第三个，再第一个，最后第二个
      resolvers[2]([{ label: "C", value: 3 }])
      await flushPromises()
      await nextTick()

      resolvers[0]([{ label: "A", value: 1 }])
      await flushPromises()
      await nextTick()

      resolvers[1]([{ label: "B", value: 2 }])
      await flushPromises()
      await nextTick()

      expect(hookReturn.list.value).toEqual([{ label: "C", value: 3 }])

      wrapper.unmount()
    })
  })

  // --- 重试 ---

  describe("重试", () => {
    it("重试 retryCount 次后报告最终错误", async () => {
      const errors = [new Error("fail 1"), new Error("fail 2"), new Error("fail 3")]

      let idx = 0

      const mockApi = vi.fn(() => Promise.reject(errors[idx++]))

      const { wrapper, hookReturn } = mountUseDictionary({
        api: mockApi,
        retryCount: 2,
        retryInterval: 0,
      })

      await nextTick()
      await flushPromises()
      await nextTick()
      await flushPromises()
      await nextTick()
      await flushPromises()
      await nextTick()

      expect(mockApi).toHaveBeenCalledTimes(3)
      expect(hookReturn.error.value?.message).toBe("fail 3")
      expect(hookReturn.loading.value).toBe(false)

      wrapper.unmount()
    })
  })

  // --- formatter ---

  describe("formatter", () => {
    it("api 返回值经过 formatter 处理后写入 list", async () => {
      const mockApi = vi.fn().mockResolvedValue({
        data: [
          { name: "广州", id: 1 },
          { name: "深圳", id: 2 },
        ],
      })

      const { wrapper, hookReturn } = mountUseDictionary({
        api: mockApi,
        formatter: (res) => {
          const response = res as { data: Array<{ name: string; id: number }> }

          return response.data.map((item) => ({
            label: item.name,
            value: item.id,
          }))
        },
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(hookReturn.list.value).toEqual([
        { label: "广州", value: 1 },
        { label: "深圳", value: 2 },
      ])

      wrapper.unmount()
    })
  })

  // --- shouldFetch ---

  describe("shouldFetch", () => {
    it("shouldFetch 返回 false 时跳过 api 调用并清空 list", async () => {
      const mockApi = vi.fn().mockResolvedValue([])

      const { wrapper, hookReturn } = mountUseDictionary({
        api: mockApi,
        shouldFetch: () => false,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(mockApi).not.toHaveBeenCalled()
      expect(hookReturn.list.value).toEqual([])

      wrapper.unmount()
    })
  })

  // --- immediate ---

  describe("immediate", () => {
    it("immediate 为 false 时挂载不执行 api", async () => {
      const mockApi = vi.fn().mockResolvedValue([{ label: "A", value: 1 }])

      const { wrapper, hookReturn } = mountUseDictionary({
        api: mockApi,
        immediate: false,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(mockApi).not.toHaveBeenCalled()
      expect(hookReturn.list.value).toEqual([])

      // 手动调用后应执行
      await hookReturn.refresh()
      await nextTick()

      expect(mockApi).toHaveBeenCalledTimes(1)
      expect(hookReturn.list.value).toEqual([{ label: "A", value: 1 }])

      wrapper.unmount()
    })
  })

  // --- mutate ---

  describe("mutate", () => {
    it("mutate 立即设置 list 且不触发 api", async () => {
      const mockApi = vi.fn().mockResolvedValue([])

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      await flushPromises()
      await nextTick()

      const callsBefore = mockApi.mock.calls.length

      hookReturn.mutate([{ label: "manual", value: 99 }])

      expect(hookReturn.list.value).toEqual([{ label: "manual", value: 99 }])
      expect(mockApi).toHaveBeenCalledTimes(callsBefore)

      wrapper.unmount()
    })
  })

  // --- refresh ---

  describe("refresh", () => {
    it("refresh 重新执行 api", async () => {
      const mockApi = vi
        .fn()
        .mockResolvedValueOnce([{ label: "initial", value: 1 }])
        .mockResolvedValueOnce([{ label: "refreshed", value: 2 }])

      const { wrapper, hookReturn } = mountUseDictionary({ api: mockApi })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(mockApi).toHaveBeenCalledTimes(1)
      expect(hookReturn.list.value).toEqual([{ label: "initial", value: 1 }])

      await hookReturn.refresh()
      await nextTick()

      expect(mockApi).toHaveBeenCalledTimes(2)
      expect(hookReturn.list.value).toEqual([{ label: "refreshed", value: 2 }])

      wrapper.unmount()
    })
  })

  // --- onSuccess / onError 回调 ---

  describe("回调", () => {
    it("api 成功后调用 onSuccess", async () => {
      const onSuccess = vi.fn()

      const mockApi = vi.fn().mockResolvedValue([{ label: "A", value: 1 }])

      const { wrapper } = mountUseDictionary({
        api: mockApi,
        onSuccess,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(onSuccess).toHaveBeenCalledTimes(1)
      expect(onSuccess).toHaveBeenCalledWith(
        [{ label: "A", value: 1 }],
        expect.anything()
      )

      wrapper.unmount()
    })

    it("api 失败后调用 onError", async () => {
      const onError = vi.fn()

      const mockApi = vi.fn().mockRejectedValue(new Error("callback test"))

      const { wrapper } = mountUseDictionary({
        api: mockApi,
        onError,
      })

      await nextTick()
      await flushPromises()
      await nextTick()

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError.mock.calls[0][0].message).toBe("callback test")

      wrapper.unmount()
    })
  })
})
