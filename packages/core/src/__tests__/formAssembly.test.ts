import { describe, expect, it, vi } from "vite-plus/test"

import * as adapterContext from "../adapter/formStateAdapter/context"
import * as compilers from "../compiler"
import { createFormConfig } from "../config/createFormConfig"
import { createForm } from "../createForm"
import { createSchemas } from "../createSchemas"
import * as rules from "../form/rules"
import * as nodes from "../node"
import * as schedulers from "../scheduler"
import * as stores from "../store"
import * as validators from "../validator"
import { isViewGroupSchema } from "../view"

import type { Values } from "../types"

describe("Form 的完整装配与资源清理", () => {
  it("字段 initialValue 同时写入当前值和重置基线，公开视图绑定稳定实例", () => {
    // 通过公开创建入口完成装配的表单。
    const form = createForm({
      schemas: [
        { name: "name", label: "姓名", componentType: "input", initialValue: "Alice" },
      ],
    })

    try {
      expect(form.getFieldValue("name")).toBe("Alice")
      expect(form.getInitialValue("name")).toBe("Alice")
      expect(form.getViewSchemas()[0]).toHaveProperty("componentProps.formInstance", form)
    } finally {
      form.destroy()
    }
  })

  it("同一 Schema source 更新字段身份和公开视图", () => {
    // 本用例持有并更新的 Schema source。
    const schemas = createSchemas<{ name?: string; email?: string }>([
      { name: "name", label: "姓名", componentType: "input" },
    ])

    // 通过公开创建入口完成装配的表单。
    const form = createForm({ schemas, schemaConfig: { validationTrigger: "blur" } })

    try {
      // 更新前的字段视图快照及节点身份。
      const first = form.getViewSchemas()[0]

      schemas.update(() => [{ name: "email", label: "邮箱", componentType: "input" }])
      // 更新后的字段视图快照。
      const next = form.getViewSchemas()[0]

      if (!first || !next) {
        throw new Error("字段视图未创建")
      }

      expect(next.nodeId).not.toBe(first.nodeId)
      expect(form.getViewSchemas()).toMatchObject([{ name: "email" }])
    } finally {
      form.destroy()
    }
  })

  it("配置刷新保留已有字段值和初始值基线", () => {
    // 通过公开创建入口完成装配的表单。
    const form = createForm({
      schemas: [
        { name: "name", label: "姓名", componentType: "input", initialValue: "Alice" },
      ],
    })

    try {
      // 更新前的字段视图快照及节点身份。
      const first = form.getViewSchemas()[0]

      form.setFieldValue("name", "Bob")
      form.setConfig({ schemaConfig: { readonly: true } })
      expect(form.getViewSchemas()[0]?.nodeId).toBe(first?.nodeId)
      expect(form.getViewSchemas()[0]).toMatchObject({ readonly: true })
      expect(form.getFieldValue("name")).toBe("Bob")
      form.resetField("name")
      expect(form.getFieldValue("name")).toBe("Alice")
    } finally {
      form.destroy()
    }
  })

  it("重复销毁安全，之后 source 更新不再注册字段", () => {
    // 本用例持有并更新的 Schema source。
    const schemas = createSchemas<Values>([
      { name: "name", label: "姓名", componentType: "input" },
    ])

    // 通过公开创建入口完成装配的表单。
    const form = createForm({ schemas })

    // 读取所属表单的原生 Store 和统一终态。
    const { store, disposed } = adapterContext.getFormStateAdapterContext(form)

    // 记录表单关闭后是否再次注册字段。
    const register = vi.spyOn(store, "registerFieldPath")

    form.destroy()
    form.destroy()
    schemas.set([{ name: "email", label: "邮箱", componentType: "input" }])
    expect(register).not.toHaveBeenCalled()
    expect(disposed.peek()).toBe(true)
    expect(form.getViewSchemas()).toEqual([])
  })

  it("初次协调失败时释放已创建的资源并保留原始错误", () => {
    // 用例使用的真实路径值和字段状态。
    const store = stores.createStore()

    // 模拟首次节点注册失败的原始错误。
    const error = new Error("register failed")

    // 记录已创建 Store 的清理次数。
    const destroy = vi.spyOn(store, "destroy")

    vi.spyOn(store, "registerFieldPath").mockImplementation(() => {
      throw error
    })
    // 让被测入口使用可观察的真实 Store。
    const createStore = vi.spyOn(stores, "createStore").mockReturnValueOnce(store)

    try {
      expect(() =>
        createForm({
          schemas: [{ name: "name", label: "姓名", componentType: "input" }],
        })
      ).toThrow(error)
      expect(destroy).toHaveBeenCalledTimes(1)
    } finally {
      createStore.mockRestore()
    }
  })

  it("先发布终态和取消订阅，再清理节点值，最后停止公开 effect", () => {
    // 本用例持有并更新的 Schema source。
    const schemas = createSchemas<Values>([
      {
        name: "name",
        label: "姓名",
        componentType: "input",
        initialValue: "Alice",
        preserve: false,
      },
    ])

    // 记录终态、订阅取消及值清理的实际通知顺序。
    const events: string[] = []

    // 保留 source 的真实订阅建立行为。
    const subscribe = schemas.subscribe

    vi.spyOn(schemas, "subscribe").mockImplementation((listener) => {
      // listener 是 Form 对 source 更新的协调回调。
      const stop = subscribe(listener)

      return () => {
        events.push("unsubscribe")
        stop()
      }
    })
    // 通过公开创建入口完成装配的表单。
    const form = createForm({ schemas })

    // 读取所属表单的原生 Store 和统一终态。
    const { disposed } = adapterContext.getFormStateAdapterContext(form)

    form.effect(() => {
      events.push(disposed.value ? "disposed" : "active")
    })
    form.effect(() => {
      events.push(String(form.getFieldValue("name")))
    })
    form.destroy()
    expect(events).toEqual(["active", "Alice", "disposed", "unsubscribe", "undefined"])
    form.setFieldValue("name", "late")
    expect(events).toHaveLength(5)
    expect(form.getViewSchemas()).toEqual([])
  })

  it("停止公开 effect 后才由校验域清理错误状态", () => {
    // 手动字段没有节点卸载行为，错误只在校验器销毁阶段清理。
    const form = createForm({ initialValues: { name: "Ada" } })

    form.setFieldErrors("name", ["external"])

    // 若校验域先于 effectScope 销毁，会多观察到一次错误清空。
    const observeErrors = vi.fn(() => form.getFieldErrors("name"))

    form.effect(observeErrors)
    form.destroy()
    expect(observeErrors).toHaveBeenCalledTimes(1)
    expect(form.getFieldErrors("name")).toEqual([])
  })

  it("订阅建立时同步销毁 Form，晚返回的取消函数仍只执行一次", () => {
    // 本用例持有并更新的 Schema source。
    const schemas = createSchemas([])

    // 记录晚返回的订阅清理是否恰好执行一次。
    const unsubscribe = vi.fn()

    // 实例在首次协调前已完成拼接，捕获其真实销毁入口。
    let destroyCurrent: (() => void) | undefined

    // 保留原生 context 登记，实例在首次协调前已可供 adapter 使用。
    const registerContext = adapterContext.setFormStateAdapterContext

    // 从实际登记边界捕获销毁入口，不增加生产代码的测试钩子。
    const contextRegistration = vi
      .spyOn(adapterContext, "setFormStateAdapterContext")
      .mockImplementation((form, context) => {
        // form 是已完成 API 拼接的实例，context 是其原生状态依赖。
        registerContext(form, context)
        destroyCurrent = form.destroy
      })

    vi.spyOn(schemas, "subscribe").mockImplementation(() => {
      if (!destroyCurrent) {
        throw new Error("实例尚未完成拼接")
      }

      destroyCurrent()

      return unsubscribe
    })

    try {
      // 通过公开创建入口完成装配的表单。
      const form = createForm({ schemas })

      form.destroy()
      expect(adapterContext.getFormStateAdapterContext(form).disposed.peek()).toBe(true)
      expect(unsubscribe).toHaveBeenCalledTimes(1)
    } finally {
      contextRegistration.mockRestore()
    }
  })

  it.each(["rules", "compiler"] as const)("%s 创建失败时统一释放公共资源", (stage) => {
    // stage 指定故障工厂，真实公共资源用于观察一次性清理。
    const configuration = createFormConfig()

    // 用例使用的真实路径值和字段状态。
    const store = stores.createStore()

    // 使用真实 Store 执行规则并协调校验取消。
    const validator = validators.createValidator({
      fieldStore: store,
      presetRuleRegistry: configuration.getConfig().presetRuleRegistry,
    })

    // 维护当前测试图的节点身份及路径索引。
    const nodeManager = nodes.createNodeManager()

    // 承载当前用例整棵节点树的根。
    const root = nodeManager.getRoot()

    // 跟踪用例中的依赖调度和异步任务。
    const scheduler = schedulers.createScheduler()

    // 记录 Store 是否被统一清理一次。
    const destroyStore = vi.spyOn(store, "destroy")

    // 记录 Validator 是否被统一清理一次。
    const destroyValidator = vi.spyOn(validator, "destroy")

    // 记录节点索引是否被统一关闭一次。
    const disposeNodes = vi.spyOn(nodeManager, "dispose")

    // 记录 Scheduler 是否被统一关闭一次。
    const disposeScheduler = vi.spyOn(scheduler, "dispose")

    // 让被测入口使用可观察的真实 Store。
    const createStore = vi.spyOn(stores, "createStore").mockReturnValueOnce(store)

    // 让被测入口使用可观察的真实 Validator。
    const createValidator = vi
      .spyOn(validators, "createValidator")
      .mockReturnValueOnce(validator)

    // 让被测入口使用可观察的真实节点管理器。
    const createNodes = vi
      .spyOn(nodes, "createNodeManager")
      .mockReturnValueOnce(nodeManager)

    // 让被测入口使用可观察的真实调度器。
    const createScheduler = vi
      .spyOn(schedulers, "createScheduler")
      .mockReturnValueOnce(scheduler)

    // 注入当前创建阶段的原始异常。
    const failure = new Error(`${stage} creation failed`)

    // 规则装配失败由校验域清理 Validator，后续失败由 Form 统一清理。
    const failingFactory =
      stage === "rules"
        ? vi.spyOn(rules, "createFormRules").mockImplementationOnce(() => {
            throw failure
          })
        : vi.spyOn(compilers, "createSchemaCompiler").mockImplementationOnce(() => {
            throw failure
          })

    try {
      expect(() => createForm()).toThrow(failure)
      expect(destroyValidator).toHaveBeenCalledTimes(1)
      expect(destroyStore).toHaveBeenCalledTimes(1)
      expect(disposeNodes).toHaveBeenCalledTimes(1)
      expect(disposeScheduler).toHaveBeenCalledTimes(1)
      expect(root.scope.disposed).toBe(true)
    } finally {
      createStore.mockRestore()
      createValidator.mockRestore()
      createNodes.mockRestore()
      createScheduler.mockRestore()
      failingFactory.mockRestore()
      configuration.dispose()
    }
  })
  it("单次投影在订阅和读取间共享快照，修改一个字段保留兄弟引用", async () => {
    // 两个字段位于同一分组，配置更新仅替换第一个字段的 Schema 对象。
    const first = { key: "first", name: "first", label: "first", componentType: "input" }

    const second = {
      key: "second",
      name: "second",
      label: "second",
      componentType: "input",
    }

    const form = createForm({
      schemas: [{ key: "group", label: "group", children: [first, second] }],
    })

    // 同步读取和订阅必须复用节点 computed 的最终列表。
    const observed = vi.fn()

    const stop = form.subscribeViewSchemas(observed)

    try {
      const before = form.getViewSchemas()

      expect(form.getViewSchemas()).toBe(before)
      const group = before[0]

      if (!group || !isViewGroupSchema(group)) {
        throw new Error("Group 视图未创建")
      }

      expect(group.children[1]).toHaveProperty("componentProps.formInstance", form)
      form.setSchemas([
        {
          key: "group",
          label: "group",
          children: [{ ...first, label: "updated" }, second],
        },
      ])
      await form.waitForDependencies()
      // 视图订阅使用既有防抖策略，等待同一公开通知边界。
      await new Promise((resolve) => setTimeout(resolve, 30))
      const after = form.getViewSchemas()

      const nextGroup = after[0]

      if (!nextGroup || !isViewGroupSchema(nextGroup)) {
        throw new Error("Group 视图未创建")
      }

      expect(nextGroup.children[0]).not.toBe(group.children[0])
      expect(nextGroup.children[1]).toBe(group.children[1])
      expect(observed.mock.calls.at(-1)?.[0]).toBe(after)
    } finally {
      stop()
      form.destroy()
    }
  })
})
