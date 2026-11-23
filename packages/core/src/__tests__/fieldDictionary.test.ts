import { describe, expect, it, vi } from "vite-plus/test"

import { createForm, createRendererRegistry } from "../index"

import type { RendererRegistry, SchemxDictionary, SchemxField } from "../index"

interface TestValues {
  province: string
  city: string
  note: string
}

interface CityOption {
  label: string
  value: string
}

const CITIES: CityOption[] = [
  { label: "杭州", value: "HZ" },
  { label: "宁波", value: "NB" },
]

const CITY_SCHEMA = {
  name: "city",
  label: "城市",
  componentType: "select",
} as const

/**
 * 字典配置类型别名，便于按需收窄响应与选项类型。
 */
type CityDict<TResponse = readonly CityOption[], TOption = CityOption> = SchemxDictionary<
  TestValues,
  TResponse,
  TOption
>

/**
 * 创建普通 Renderer 注册表，字典独立由字段配置启用。
 */
function createRegistry() {
  const registry = createRendererRegistry<TestValues>()

  registry.register("select", {})
  registry.register("input", {})

  return registry
}

/**
 * 构造携带字典配置的城市字段。
 */
function citySchema<TResponse, TOption>(dict: CityDict<TResponse, TOption>) {
  return {
    ...CITY_SCHEMA,
    dict,
  }
}

/**
 * 创建带字典字段的表单。
 */
function createTestForm<TResponse = readonly CityOption[], TOption = CityOption>(
  options: {
    dict?: CityDict<TResponse, TOption>
    schemas?: SchemxField<TestValues>[]
    initialValues?: TestValues
  } = {}
) {
  const dict =
    options.dict ??
    ({ api: async () => CITIES } as unknown as CityDict<TResponse, TOption>)

  return createForm<TestValues>({
    // 创建选项按 Values 擦除渲染器泛型，测试只在注册表内保持精确类型。
    rendererRegistry: createRegistry() as unknown as RendererRegistry,
    initialValues: options.initialValues ?? { province: "ZJ", city: "", note: "" },
    schemas: options.schemas ?? [
      citySchema({ immediate: false, ...dict }) as SchemxField<TestValues>,
    ],
  })
}

/**
 * 判断未知选项是否匹配 value，供列表 action 保留原选项的其他字段。
 * @param option - 当前列表中的选项。
 * @param value - 目标 value。
 */
function matchesOption(
  option: unknown,
  value: string
): option is Record<string, unknown> {
  return (
    typeof option === "object" &&
    option !== null &&
    "value" in option &&
    option.value === value
  )
}

describe("字段字典", () => {
  it("Core 挂载隐藏字段也会自动加载，并读取同批字段初始值", async () => {
    // 记录请求时完整的表单值。
    const api = vi.fn(async (values: TestValues) =>
      values.province === "JS" ? CITIES : []
    )

    // city 先挂载，province 后挂载；post 请求应读到全部初始值。
    const form = createForm<TestValues>({
      rendererRegistry: createRegistry() as unknown as RendererRegistry,
      schemas: [
        {
          ...CITY_SCHEMA,
          dict: { api },
          visible: false,
        } as SchemxField<TestValues>,
        { name: "province", label: "省份", componentType: "input", initialValue: "JS" },
      ],
    })

    expect(api).not.toHaveBeenCalled()
    await form.waitForDependencies()
    expect(api).toHaveBeenCalledTimes(1)
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)
    form.destroy()
  })

  it("immediate false 跳过首次加载，但依赖变化仍会请求", async () => {
    // 记录依赖变更触发的自动请求。
    const api = vi.fn(async () => CITIES)

    // 手动模式也应在挂载后建立依赖监听。
    const form = createTestForm({
      dict: { api, immediate: false, dependsOn: ["province"] },
    })

    await form.waitForDependencies()
    expect(api).not.toHaveBeenCalled()
    form.setFieldValue("province", "JS")
    await form.waitForDependencies()
    expect(api).toHaveBeenCalledTimes(1)
    form.destroy()
  })

  it("配置替换取消旧请求，切换依赖监听并自动加载新配置", async () => {
    // 控制旧请求的晚到响应。
    const gate = Promise.withResolvers<readonly CityOption[]>()

    // 旧请求的取消信号。
    let signal: AbortSignal | undefined

    // values 和 form 是旧请求上下文，requestSignal 用于验证取消。
    const oldApi = vi.fn(
      (_values: TestValues, _form: unknown, requestSignal?: AbortSignal) => {
        signal = requestSignal

        return gate.promise
      }
    )

    // 新配置监听 note，不再监听 province。
    const nextApi = vi.fn(async () => [{ label: "新选项", value: "NEW" }])

    // 先启动旧请求，再替换同一节点的配置。
    const form = createTestForm({
      dict: { api: oldApi, immediate: true, dependsOn: ["province"] },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    form.setSchemas([
      citySchema({
        api: nextApi,
        immediate: true,
        dependsOn: ["note"],
      }) as SchemxField<TestValues>,
    ])
    expect(await form.waitForDependencies(100)).toBe(true)
    expect(signal?.aborted).toBe(true)
    expect(nextApi).toHaveBeenCalledTimes(1)
    gate.resolve(CITIES)
    await Promise.resolve()
    form.setFieldValue("province", "JS")
    await form.waitForDependencies()
    expect(nextApi).toHaveBeenCalledTimes(1)
    form.setFieldValue("note", "changed")
    await form.waitForDependencies()
    expect(nextApi).toHaveBeenCalledTimes(2)
    expect(form.getFieldDictOptions("city")).toEqual([{ label: "新选项", value: "NEW" }])
    form.destroy()
  })

  it("节点在 post 前卸载时不请求，在途请求卸载后退出等待边界", async () => {
    // 记录尚未执行的自动加载。
    const api = vi.fn(async () => CITIES)

    // 在调度器开始前移除节点。
    const form = createTestForm({ dict: { api, immediate: true } })

    form.setSchemas([])
    await form.waitForDependencies()
    expect(api).not.toHaveBeenCalled()
    form.destroy()

    // 永不完成的传输也不应阻塞卸载后的调度器。
    const gate = Promise.withResolvers<readonly CityOption[]>()

    // 执行中请求收到的中止信号。
    let signal: AbortSignal | undefined

    // values、form 是请求上下文；requestSignal 验证卸载时中止。
    const active = createTestForm({
      dict: {
        immediate: true,
        api: (_values, _form, requestSignal) => {
          signal = requestSignal

          return gate.promise
        },
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    active.setSchemas([])
    expect(await active.waitForDependencies(100)).toBe(true)
    expect(signal?.aborted).toBe(true)
    gate.resolve(CITIES)
    active.destroy()
  })

  it("不同字段自动请求并行启动，调度器等待全部完成", async () => {
    // 两个独立字段请求的完成闸门。
    const first = Promise.withResolvers<readonly CityOption[]>()

    // 第二个字段请求的完成闸门。
    const second = Promise.withResolvers<readonly CityOption[]>()

    // 用于确认两次请求均已开始。
    const api = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    // 两个具有独立字典资源的字段。
    const form = createTestForm({
      schemas: [
        citySchema({ api, immediate: true }) as SchemxField<TestValues>,
        {
          ...citySchema({ api, immediate: true }),
          name: "province",
        } as SchemxField<TestValues>,
      ],
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(api).toHaveBeenCalledTimes(2)
    first.resolve(CITIES)
    expect(await form.waitForDependencies(10)).toBe(false)
    second.resolve(CITIES)
    expect(await form.waitForDependencies()).toBe(true)
    form.destroy()
  })

  it("只有配置了 dict 的字段才持有字典运行态", () => {
    const form = createTestForm({
      schemas: [
        citySchema({ api: async () => CITIES }) as SchemxField<TestValues>,
        { name: "note", label: "备注", componentType: "input" },
      ],
    })

    expect(form.getFieldDict("city")).toBeDefined()
    expect(form.getFieldDict("city")?.status).toBe("idle")
    expect(form.getFieldDictOptions("city")).toEqual([])

    // 没有配置 dict 的字段不创建通道。
    expect(form.getFieldDict("note")).toBeUndefined()

    form.destroy()
  })

  it("未声明字典的字段返回 unregistered 而不抛错", async () => {
    const form = createForm<TestValues>({
      rendererRegistry: createRegistry() as unknown as RendererRegistry,
      initialValues: { province: "ZJ", city: "", note: "" },
      schemas: [{ name: "province", label: "省份", componentType: "input" }],
    })

    expect(form.getFieldDict("province")).toBeUndefined()
    expect(form.getFieldDict("province")).toBeUndefined()
    expect(form.setFieldDictOptions("province", [{ label: "浙江", value: "ZJ" }])).toBe(
      false
    )
    expect(await form.refreshFieldDict("province")).toEqual({
      ok: false,
      reason: "unregistered",
    })

    form.destroy()
  })

  it("loadFieldDict 拉取选项并维护状态与版本", async () => {
    const form = createTestForm()

    expect(form.getFieldDict("city")?.status).toBe("idle")
    expect(form.getFieldDictOptions("city")).toEqual([])

    const result = await form.loadFieldDict("city")

    expect(result).toEqual({ ok: true, options: CITIES, version: 1 })
    expect(form.getFieldDict("city")?.status).toBe("success")
    expect(form.getFieldDict("city")?.loading).toBe(false)
    expect(form.getFieldDict("city")?.version).toBe(1)
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.destroy()
  })

  it("同字段未完成的刷新合并为同一个 Promise", async () => {
    let release!: (options: readonly CityOption[]) => void

    const gate = new Promise<readonly CityOption[]>((resolve) => {
      release = resolve
    })

    const api = vi.fn(async () => gate)

    const form = createTestForm({ dict: { api } })

    const first = form.refreshFieldDict("city")

    const second = form.refreshFieldDict("city")

    expect(first).toBe(second)
    expect(api).toHaveBeenCalledTimes(1)

    release(CITIES)

    await first
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.destroy()
  })

  it.each([false, true])(
    "loadFieldDict 等待在途请求并复用真实结果（失败：%s）",
    async (failed) => {
      // gate 控制本次远端请求何时成功或失败。
      const gate = Promise.withResolvers<readonly CityOption[]>()

      // 远端只应执行一次。
      const api = vi.fn(() => gate.promise)

      // 使用可控请求的表单。
      const form = createTestForm({ dict: { api } })

      // 首次加载与并发调用应返回相同 Promise。
      const first = form.loadFieldDict("city")

      // 第二次加载复用首个请求。
      const second = form.loadFieldDict("city")

      // 验证第二次调用不会提前完成。
      let settled = false

      void second.then(() => {
        settled = true
      })
      await Promise.resolve()

      expect(second).toBe(first)
      expect(form.refreshFieldDict("city")).toBe(first)
      expect(settled).toBe(false)
      expect(form.getFieldDict("city")?.loading).toBe(true)
      expect(api).toHaveBeenCalledTimes(1)

      if (failed) {
        gate.reject(new Error("network down"))
        expect(await second).toMatchObject({ ok: false, reason: "failed" })
      } else {
        gate.resolve(CITIES)
        expect(await second).toEqual({ ok: true, options: CITIES, version: 1 })
        expect(await form.loadFieldDict("city")).toEqual(await first)
        expect(api).toHaveBeenCalledTimes(1)
      }

      form.destroy()
    }
  )

  it("在途请求期间本地写入不结束加载，响应成功后覆盖本地选项", async () => {
    // 控制远端响应返回时间。
    const gate = Promise.withResolvers<readonly CityOption[]>()

    // 正在请求城市选项的表单。
    const form = createTestForm({ dict: { api: () => gate.promise } })

    // 在途请求应保持可复用。
    const pending = form.refreshFieldDict("city")

    form.setFieldDictOptions("city", [{ label: "本地", value: "LOCAL" }])
    expect(form.getFieldDict("city")).toMatchObject({ status: "loading", loading: true })
    expect(form.getFieldDictOptions("city")).toEqual([{ label: "本地", value: "LOCAL" }])
    expect(form.loadFieldDict("city")).toBe(pending)

    gate.resolve(CITIES)
    await pending
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.destroy()
  })

  it("cancelFieldDict 中止旧请求，慢响应不覆盖新结果", async () => {
    let releaseFirst!: (options: readonly CityOption[]) => void

    let firstSignal: AbortSignal | undefined

    const api = vi
      .fn<CityDict["api"]>()
      .mockImplementationOnce(async (_values, _form, signal) => {
        firstSignal = signal

        return new Promise<readonly CityOption[]>((resolve) => {
          releaseFirst = resolve
        })
      })
      .mockImplementationOnce(async () => [{ label: "温州", value: "WZ" }])

    const form = createTestForm({ dict: { api } })

    const first = form.refreshFieldDict("city")

    form.cancelFieldDict("city")

    const second = await form.refreshFieldDict("city")

    expect(firstSignal?.aborted).toBe(true)
    expect(second.ok && second.options).toEqual([{ label: "温州", value: "WZ" }])

    releaseFirst(CITIES)

    expect(await first).toEqual({ ok: false, reason: "aborted" })
    expect(form.getFieldDictOptions("city")).toEqual([{ label: "温州", value: "WZ" }])

    form.destroy()
  })

  it("已中止的请求在 API 随后拒绝时不会重试", async () => {
    // 模拟一个忽略中止信号、稍后才失败的请求。
    const gate = Promise.withResolvers<readonly CityOption[]>()

    const api = vi.fn<CityDict["api"]>().mockReturnValueOnce(gate.promise)

    const form = createTestForm({ dict: { api, retryCount: 1, retryInterval: 0 } })

    const pending = form.loadFieldDict("city")

    form.cancelFieldDict("city")
    gate.reject(new Error("network down"))

    expect(await pending).toEqual({ ok: false, reason: "aborted" })
    expect(api).toHaveBeenCalledTimes(1)

    form.destroy()
  })

  it("labelKey/valueKey 映射后的列表可通过 action 更新和筛选", async () => {
    const registry = createRendererRegistry<TestValues>()

    registry.register("select", {})

    const rows = [
      { code: "a", name: "A" },
      { code: "b", name: "B" },
    ]

    const form = createForm<TestValues>({
      rendererRegistry: registry as unknown as RendererRegistry,
      initialValues: { province: "ZJ", city: "", note: "" },
      schemas: [
        {
          name: "city",
          label: "城市",
          componentType: "select",
          dict: { api: async () => rows, keys: { labelKey: "name", valueKey: "code" } },
        },
      ],
    })

    await form.loadFieldDict("city")

    // 原始字段保留，同时补出统一的 label / value。
    expect(form.getFieldDictOptions("city")).toEqual([
      { code: "a", name: "A", label: "A", value: "a" },
      { code: "b", name: "B", label: "B", value: "b" },
    ])

    // options 是当前列表，option 是待更新的选项。
    expect(
      form.setFieldDictOptions("city", (options) =>
        options.map((option) =>
          matchesOption(option, "a") ? { ...option, label: "A+" } : option
        )
      )
    ).toBe(true)
    // options 是当前列表，option 是待筛选的选项。
    expect(
      form.setFieldDictOptions("city", (options) =>
        options.filter((option) => !matchesOption(option, "b"))
      )
    ).toBe(true)
    expect(form.getFieldDictOptions("city")).toEqual([
      { code: "a", name: "A", label: "A+", value: "a" },
    ])

    form.destroy()
  })

  it("formatter 优先于字段映射，不再补 label/value", async () => {
    const registry = createRendererRegistry<TestValues>()

    registry.register("select", {})

    const form = createForm<TestValues>({
      rendererRegistry: registry as unknown as RendererRegistry,
      initialValues: { province: "ZJ", city: "", note: "" },
      schemas: [
        {
          name: "city",
          label: "城市",
          componentType: "select",
          dict: {
            api: async () => ({ list: [{ code: "a", name: "A" }] }),
            keys: { labelKey: "name", valueKey: "code" },
            // formatter 返回的键名应原样保留，不再应用 keys。
            formatter: () => [{ name: "自定义", code: "custom" }],
          },
        },
      ],
    })

    await form.loadFieldDict("city")

    expect(form.getFieldDictOptions("city")).toEqual([{ name: "自定义", code: "custom" }])

    form.destroy()
  })

  it("childrenKey 递归映射子选项", async () => {
    const registry = createRendererRegistry<TestValues>()

    registry.register("select", {})

    const tree = [
      {
        code: "zj",
        name: "浙江",
        subs: [{ code: "hz", name: "杭州", subs: [] }],
      },
    ]

    const form = createForm<TestValues>({
      rendererRegistry: registry as unknown as RendererRegistry,
      initialValues: { province: "ZJ", city: "", note: "" },
      schemas: [
        {
          name: "city",
          label: "城市",
          componentType: "select",
          dict: {
            api: async () => tree,
            keys: { labelKey: "name", valueKey: "code", childrenKey: "subs" },
          },
        },
      ],
    })

    await form.loadFieldDict("city")

    expect(form.getFieldDictOptions("city")).toEqual([
      {
        code: "zj",
        name: "浙江",
        subs: [{ code: "hz", name: "杭州", subs: [] }],
        label: "浙江",
        value: "zj",
        children: [
          {
            code: "hz",
            name: "杭州",
            subs: [],
            label: "杭州",
            value: "hz",
            children: [],
          },
        ],
      },
    ])

    form.destroy()
  })

  it("refresh 以远端结果覆盖全部本地替换、更新与删除", async () => {
    // 持有城市远端字典的表单。
    const form = createTestForm()

    await form.loadFieldDict("city")

    // options 是当前只读列表，追加本地选项时返回新数组。
    expect(
      form.setFieldDictOptions("city", (options) => [
        ...options,
        { label: "绍兴", value: "SX" },
      ])
    ).toBe(true)
    // options 是当前列表，option 是待更新的选项。
    expect(
      form.setFieldDictOptions("city", (options) =>
        options.map((option) =>
          matchesOption(option, "NB") ? { ...option, label: "宁波市" } : option
        )
      )
    ).toBe(true)
    // options 是当前列表，option 是待筛选的选项。
    expect(
      form.setFieldDictOptions("city", (options) =>
        options.filter((option) => !matchesOption(option, "HZ"))
      )
    ).toBe(true)

    expect(form.getFieldDictOptions("city")).toEqual([
      { label: "宁波市", value: "NB" },
      { label: "绍兴", value: "SX" },
    ])
    expect(form.getFieldDict("city")?.version).toBe(1)

    await form.refreshFieldDict("city")

    expect(form.getFieldDictOptions("city")).toEqual(CITIES)
    expect(form.getFieldDict("city")?.version).toBe(2)
    expect(CITIES).toEqual([
      { label: "杭州", value: "HZ" },
      { label: "宁波", value: "NB" },
    ])

    form.setFieldDictOptions("city", [{ label: "嘉兴", value: "JX" }])
    expect(form.getFieldDictOptions("city")).toEqual([{ label: "嘉兴", value: "JX" }])

    await form.refreshFieldDict("city")
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.destroy()
  })

  it("setFieldDictOptions updater 支持追加、插入和排序，返回值可作为下一次输入", async () => {
    // updater 操作的表单。
    const form = createTestForm()

    await form.loadFieldDict("city")

    // options 是每次调用时最新的只读选项列表。
    form.setFieldDictOptions("city", (options) => [
      ...options,
      { label: "绍兴", value: "SX" },
    ])
    form.setFieldDictOptions("city", (options) => [
      ...options.slice(0, 1),
      { label: "嘉兴", value: "JX" },
      ...options.slice(1),
    ])
    form.setFieldDictOptions("city", (options) => [...options].reverse())

    expect(form.getFieldDictOptions("city")).toEqual([
      { label: "绍兴", value: "SX" },
      { label: "宁波", value: "NB" },
      { label: "嘉兴", value: "JX" },
      { label: "杭州", value: "HZ" },
    ])
    expect(form.getFieldDict("city")?.version).toBe(1)

    form.destroy()
  })

  it("setFieldDictOptions 清空后可通过普通刷新恢复远端选项", async () => {
    // 用空数组实现普通清空的表单。
    const form = createTestForm()

    await form.loadFieldDict("city")
    form.setFieldDictOptions("city", [])
    expect(form.getFieldDictOptions("city")).toEqual([])

    await form.refreshFieldDict("city")
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.destroy()
  })

  it("列表 action 支持批量更新和删除，无需约定选项的 value 字段", async () => {
    // 使用任意选项形状的表单。
    const form = createTestForm()

    form.setFieldDictOptions("city", ["杭州", "宁波", "绍兴"])
    // options 是只读列表，option 是需要统一转换的选项。
    form.setFieldDictOptions("city", (options) =>
      options.map((option) => `${String(option)}市`)
    )
    expect(form.getFieldDictOptions("city")).toEqual(["杭州市", "宁波市", "绍兴市"])

    // options 是最新列表，option 是需要按业务条件保留的选项。
    form.setFieldDictOptions("city", (options) =>
      options.filter((option) => option === "绍兴市")
    )
    expect(form.getFieldDictOptions("city")).toEqual(["绍兴市"])

    await form.refreshFieldDict("city")
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.destroy()
  })

  it("shouldFetch 为 false 时清空选项但不发请求、不记错误", async () => {
    const api = vi.fn(async () => CITIES)

    const form = createTestForm({
      dict: { api, shouldFetch: (values) => Boolean(values.province) },
      initialValues: { province: "", city: "", note: "" },
    })

    const result = await form.loadFieldDict("city")

    expect(api).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, options: [], version: 0 })
    expect(form.getFieldDict("city")?.status).toBe("success")
    expect(form.getFieldDict("city")?.error).toBeUndefined()

    form.destroy()
  })

  it("shouldFetch 同步跳过后，后续刷新仍能真正请求", async () => {
    // 跳过后应能根据新字段值重新执行远端 API。
    const api = vi.fn(async () => CITIES)

    // 第一次加载缺少省份，应被 shouldFetch 跳过。
    const form = createTestForm({
      dict: { api, shouldFetch: (values) => Boolean(values.province) },
      initialValues: { province: "", city: "", note: "" },
    })

    await form.loadFieldDict("city")
    form.setFieldValue("province", "ZJ")

    expect(await form.refreshFieldDict("city")).toEqual({
      ok: true,
      options: CITIES,
      version: 1,
    })
    expect(api).toHaveBeenCalledTimes(1)

    form.destroy()
  })

  it("加载失败记录 error 与 failed 状态", async () => {
    const form = createTestForm({
      dict: {
        api: async () => {
          throw new Error("network down")
        },
      },
    })

    const result = await form.refreshFieldDict("city")

    expect(result).toMatchObject({ ok: false, reason: "failed" })
    expect(form.getFieldDict("city")?.status).toBe("failed")
    expect(form.getFieldDict("city")?.error?.message).toBe("network down")

    form.destroy()
  })

  it("formatter 与 onSuccess 按 SchemxDictionary 语义执行", async () => {
    const onSuccess = vi.fn()

    const form = createTestForm({
      dict: {
        api: async () => ({ list: CITIES }),
        formatter: (res) => res.list,
        onSuccess,
      } as SchemxDictionary<TestValues, { list: CityOption[] }, CityOption>,
    })

    await form.loadFieldDict("city")

    expect(form.getFieldDictOptions("city")).toEqual(CITIES)
    expect(onSuccess).toHaveBeenCalledWith(CITIES, expect.anything())

    form.destroy()
  })

  it("retryCount 在失败后重试，成功后写入选项", async () => {
    const api = vi
      .fn<CityDict["api"]>()
      .mockRejectedValueOnce(new Error("flaky"))
      .mockResolvedValueOnce(CITIES)

    const form = createTestForm({ dict: { api, retryCount: 1, retryInterval: 0 } })

    const result = await form.loadFieldDict("city")

    expect(api).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.destroy()
  })

  it("依赖字段变化时自动重新请求，并按配置清空字段值", async () => {
    const api = vi.fn(async (values: TestValues) =>
      values.province === "JS" ? [{ label: "南京", value: "NJ" }] : CITIES
    )

    const form = createTestForm({
      dict: {
        api,
        dependsOn: ["province"],
        resetOnDepsChange: true,
      },
    })

    await form.loadFieldDict("city")

    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    form.setFieldValue("city", "HZ")
    form.setFieldValue("province", "JS")

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(api).toHaveBeenCalledTimes(2)
    expect(form.getFieldDictOptions("city")).toEqual([{ label: "南京", value: "NJ" }])
    expect(form.getFieldValue("city")).toBeUndefined()

    form.destroy()
  })

  it("schema 更新复用节点时保留字典状态，移除字典时释放", async () => {
    const dict: CityDict = { api: async () => CITIES, immediate: false }

    const form = createTestForm({
      schemas: [citySchema(dict) as SchemxField<TestValues>],
    })

    await form.loadFieldDict("city")

    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    // 同一路径、同一渲染器：仅标签变化，节点复用，字典保留。
    form.setSchemas([
      { ...citySchema(dict), label: "城市（改）" } as SchemxField<TestValues>,
    ])

    expect(form.getFieldDictOptions("city")).toEqual(CITIES)

    // 从同一节点移除配置即释放通道。
    form.setSchemas([{ ...CITY_SCHEMA }])

    expect(form.getFieldDict("city")).toBeUndefined()
    expect(form.getFieldDictOptions("city")).toEqual([])

    form.destroy()
  })

  it("动态行重排时字典跟随节点，依赖变化清空重排后的路径", async () => {
    // 字典回调读取整个表单的省份，选中项则保存在当前动态行。
    interface RowValues {
      province: string
      rows: { city: string }[]
    }

    const api = vi.fn((values: RowValues) => [{ label: values.province, value: "x" }])

    const form = createForm<RowValues>({
      initialValues: { province: "ZJ", rows: [{ city: "HZ" }, { city: "NB" }] },
      schemas: [
        {
          key: "rows",
          name: "rows",
          item: [
            {
              ...CITY_SCHEMA,
              dict: {
                api,
                immediate: false,
                dependsOn: ["province"],
                resetOnDepsChange: true,
              },
            },
          ],
        },
      ],
    })

    await form.loadFieldDict("rows.0.city")
    form.setFieldValue("rows", (rows) => [...(rows ?? [])].reverse())

    expect(form.getFieldValue("rows.0.city")).toBe("NB")
    expect(form.getFieldValue("rows.1.city")).toBe("HZ")
    expect(form.getFieldDict("rows.0.city")?.version).toBe(0)
    expect(form.getFieldDict("rows.1.city")?.version).toBe(1)
    expect(api).toHaveBeenCalledTimes(1)

    form.setFieldValue("province", "JS")
    await form.waitForDependencies()

    expect(form.getFieldValue("rows.0.city")).toBeUndefined()
    expect(form.getFieldValue("rows.1.city")).toBeUndefined()
    expect(form.getFieldDict("rows.1.city")).toMatchObject({
      options: [{ label: "JS", value: "x" }],
      version: 2,
    })

    form.destroy()
  })

  it("表单销毁后请求返回 disposed", async () => {
    const form = createTestForm()

    form.destroy()

    expect(await form.refreshFieldDict("city")).toEqual({ ok: false, reason: "disposed" })
  })

  it("字典状态可被 effect 追踪", async () => {
    const form = createTestForm()

    const seen: number[] = []

    const dispose = form.effect(() => {
      seen.push(form.getFieldDictOptions("city").length)
    })

    await form.loadFieldDict("city")

    // options 是当前只读列表，通过新数组追加本地选项。
    form.setFieldDictOptions("city", (options) => [
      ...options,
      { label: "绍兴", value: "SX" },
    ])

    dispose()
    form.destroy()

    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(3)
  })

  it("非法字段路径不会抛错", async () => {
    const form = createTestForm()

    // 类型层已拦住非法路径，运行时仍需对动态路径稳健。
    expect(form.getFieldDict("missing" as never)).toBeUndefined()
    expect(form.getFieldDictOptions("missing" as never)).toEqual([])
    expect(await form.refreshFieldDict("missing" as never)).toEqual({
      ok: false,
      reason: "unregistered",
    })

    form.destroy()
  })
})

describe("字段字典的视图投影", () => {
  it("动态启停字典会中止旧请求并恢复基础 Props", async () => {
    // 即使传输最终返回，已关闭的字典也不能写回任何视图状态。
    const response = Promise.withResolvers<CityOption[]>()

    const onSuccess = vi.fn()

    let signal: AbortSignal | undefined

    const dict = {
      targetKey: "columns",
      api: (_values, _form, requestSignal) => {
        signal = requestSignal

        return response.promise
      },
      onSuccess,
    } satisfies SchemxDictionary<TestValues>

    const form = createForm<TestValues>({
      initialValues: { province: "off", city: "", note: "" },
      schemas: [
        {
          ...CITY_SCHEMA,
          dict,
          componentProps: { columns: CITIES, loading: true } as never,
          dependencies: {
            triggerFields: ["province"],
            // false 覆盖静态配置，undefined 恢复它。
            dict: (values) => (values.province === "off" ? false : undefined),
          },
        },
      ],
    })

    const view = () => form.getViewSchemas()[0]

    await form.waitForDependencies()
    expect(form.getFieldDict("city")).toBeUndefined()
    expect(signal).toBeUndefined()
    expect(view()).toMatchObject({ componentProps: { columns: CITIES, loading: true } })

    form.setFieldValue("province", "on")
    await vi.waitFor(() => expect(signal).toBeDefined())
    expect(view()).toMatchObject({ componentProps: { columns: [], loading: true } })
    expect(view()).not.toHaveProperty("dict")
    expect(view()).not.toHaveProperty("componentProps.formItemProps.dict")

    form.setFieldValue("province", "off")
    expect(await form.waitForDependencies(100)).toBe(true)
    expect(signal?.aborted).toBe(true)
    expect(form.getFieldDict("city")).toBeUndefined()
    expect(view()).toMatchObject({ componentProps: { columns: CITIES, loading: true } })
    response.resolve([{ label: "晚到", value: "late" }])
    await response.promise
    expect(onSuccess).not.toHaveBeenCalled()
    form.destroy()
  })

  it("字段各自投影选项，换目标时恢复旧属性", async () => {
    // 第一个字段自带静态选项，切换注入目标时应恢复。
    const first = {
      ...CITY_SCHEMA,
      key: "first",
      componentProps: { options: ["静态"], columns: ["静态列"] } as never,
      dict: { api: () => ["甲"] },
    }

    // 另一个活动字段的选项不受切换影响。
    const second: SchemxField<TestValues> = {
      ...CITY_SCHEMA,
      key: "second",
      name: "note",
      dict: () => ["乙"],
    }

    const form = createForm<TestValues>({ schemas: [first, second] })

    await form.waitForDependencies()

    expect(form.getViewSchemas()).toMatchObject([
      { componentProps: { options: ["甲"], columns: ["静态列"] } },
      { componentProps: { options: ["乙"] } },
    ])

    form.setSchemas([
      { ...first, dict: { targetKey: "columns", api: () => ["新列"] } },
      second,
    ])
    await form.waitForDependencies()
    expect(form.getViewSchemas()).toMatchObject([
      { componentProps: { options: ["静态"], columns: ["新列"] } },
      { componentProps: { options: ["乙"] } },
    ])
    form.destroy()
  })

  it("字段字典优先使用字段配置，其余设置来自 Renderer 默认值", async () => {
    const registry = createRendererRegistry()

    const component = {}

    registry.registerAll({
      select: {
        component,
        dictionary: { targetKey: "columns", keys: { labelKey: "name" } },
      },
    })

    const rows = [{ name: "杭州", code: "HZ" }]

    const form = createForm<TestValues>({
      rendererRegistry: registry,
      schemas: [
        { ...CITY_SCHEMA, dict: () => rows },
        {
          ...CITY_SCHEMA,
          name: "note",
          dict: { api: () => rows, targetKey: "options", keys: { valueKey: "code" } },
        },
        { ...CITY_SCHEMA, name: "province" },
      ],
    })

    await form.waitForDependencies()

    expect(registry.getEntry("select")?.component).toBe(component)
    expect(form.getViewSchemas()).toMatchObject([
      { componentProps: { columns: [{ ...rows[0], label: "杭州" }] } },
      { componentProps: { options: [{ ...rows[0], value: "HZ" }] } },
      { componentProps: {} },
    ])
    expect(form.getFieldDict("province")).toBeUndefined()

    const customOptions = [{ label: "本地", value: "local" }]

    form.setFieldDictOptions("note", customOptions)
    form.registerRenderer("select", { component, dictionary: true })
    await form.waitForDependencies()

    expect(form.getRendererEntry("select")?.dictionary).toEqual({ targetKey: "options" })
    expect(form.getViewSchemas()[0]).toMatchObject({ componentProps: { options: rows } })
    expect(form.getViewSchemas()[0]).not.toHaveProperty("componentProps.columns")
    expect(form.getFieldDictOptions("note")).toEqual(customOptions)

    form.destroy()
  })

  it("旧字段字典写法和受控目标给出明确错误", () => {
    const registry = createRendererRegistry()

    expect(() =>
      registry.register("select", {
        component: {},
        dictionary: { targetKey: "value" },
      })
    ).toThrow(/不能将字段字典注入/)
    expect(() =>
      createForm({
        schemas: [
          {
            ...CITY_SCHEMA,
            componentProps: { dict: { api: () => [] } } as never,
          },
        ],
      })
    ).toThrow(/componentProps.dict 已移除/)
    for (const targetKey of ["value", "onChange"]) {
      expect(() =>
        createForm({
          schemas: [
            {
              ...CITY_SCHEMA,
              dict: { targetKey, api: () => [] },
            },
          ],
        })
      ).toThrow(/不能将字段字典注入/)
    }
  })
})
