import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createSchemaCompiler } from "../../compiler"
import { createFormConfig } from "../../config/createFormConfig"
import { createSchemas } from "../../createSchemas"
import { createNodeManager, createScope, isFieldNode } from "../../node"
import { createSignalEffect } from "../../reactivity"
import { createReconciler } from "../../reconciler"
import { createScheduler } from "../../scheduler"
import { createStore } from "../../store"
import { createValidator } from "../../validator"

import type { NodeManager } from "../../node"
import type { NodeId } from "../../node/types"
import type { FormRuntimeContext } from "../../runtimeContext"
import type { Store } from "../../store/types"
import type { SchemxInstance } from "../../types"
import type { SchemxField, SchemxFieldRulesMap, SchemxFormApi } from "../../types"
import type { ValidationRuleResult } from "../../validator/types"

/**
 * 生命周期测试可覆盖的业务规则配置。
 */
interface LifecycleOptions {
  /**
   * 表单级字段规则兜底。
   */
  readonly fieldRules?: SchemxFieldRulesMap
}

// 每个用例释放其真实 Runtime、Validator 和 Store。
const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup()
  }
})

/**
 * 组合真实的 NamePath Store、Validator 和 NodeId Runtime。
 * @param fields - 当前 Schema 列表。
 * @param options - 可选的公开兜底规则配置。
 */
function setup(fields: SchemxField[], options: LifecycleOptions = {}) {
  // Schema source 驱动节点身份的挂载、更新和卸载。
  const schemas = createSchemas(fields)

  // 生命周期更新通过配置模型提交生效配置。
  const configuration = createFormConfig({ config: { schemaConfig: {} } })

  // 每个夹具拥有自己的资源清理清单。
  const scope = createScope()

  scope.add(configuration.dispose)

  // 用例使用的真实路径值和字段状态。
  const store = createStore()

  scope.add(store.destroy.bind(store))

  // 与路径状态共享规则配置的真实校验器。
  const validation = createValidator({
    fieldStore: store,
    presetRuleRegistry: configuration.getConfig().presetRuleRegistry,
  })

  scope.add(validation.destroy.bind(validation))

  // 跟踪用例中的依赖调度和异步任务。
  const scheduler = createScheduler()

  scope.add(scheduler.dispose)

  // 维护当前测试图的节点身份及路径索引。
  const nodeManager = createNodeManager()

  // 承载当前用例整棵节点树的根。
  const root = nodeManager.getRoot()

  scope.add(root.scope.dispose)
  scope.add(nodeManager.dispose)

  // 按配置快照编译 Schema 并分配新节点身份。
  const compiler = createSchemaCompiler({ config: configuration.getConfig() })

  scope.add(compiler.invalidateConfigCache)

  // 直接向节点模块提供同一组资源和消费端 API。
  const context: FormRuntimeContext = {
    getInstance: () => context.formApi as SchemxInstance,
    debug: false,
    fieldRules: options.fieldRules ?? {},
    store,
    validator: validation,
    nodeManager,
    scheduler,
    formApi: {} as SchemxFormApi,
  }

  // 实际提交本用例的节点更新。
  const reconciler = createReconciler({ compiler, context, lifecycleHooks: {} })

  scope.add(reconciler.clear)
  scope.add(
    schemas.subscribe((next) => {
      // next 是用例发布的完整 Schema 列表。
      reconciler.reconcile(next)
    })
  )
  scope.add(() => {
    root.disposed.value = true
  })
  cleanups.push(scope.dispose)

  return {
    store,
    validation,
    schemas,
    configuration,
    compiler,
    reconciler,
    nodeManager,
    scheduler,
  }
}

/**
 * 取得当前位置的活动字段 ID。
 * @param nodeManager - 当前测试图的节点索引。
 * @param path - 要查询的业务路径。
 */
function fieldId(nodeManager: NodeManager, path: string): NodeId {
  // ID 只用于节点身份断言，不作为 Store 的字段地址。
  const [nodeId] = nodeManager.getNodeIds(path)

  if (nodeId === undefined) {
    throw new Error(`未登记字段 ${path}`)
  }

  return nodeId
}

/**
 * 编辑当前路径的值和交互状态。
 * @param store - 当前 NamePath Store。
 * @param path - 当前字段地址。
 */
function edit(store: Store, path: string): void {
  store.setFieldValue(path, "edited")
  store.setFieldTouched(path, true)
}

describe("Runtime 的 NodeId 身份与 NamePath 字段生命周期", () => {
  it("Schema 默认值按路径写入，配置刷新保留当前值和初始值基线", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const {
      store,
      configuration,
      nodeManager,
      scheduler,
      compiler,
      reconciler,
      schemas,
    } = setup([
      {
        key: "name",
        name: "name",
        label: "姓名",
        componentType: "input",
        initialValue: "Alice",
      },
    ])

    reconciler.reconcile(schemas.peek())

    // 默认配置刷新复用节点，不重写路径数据。
    const nodeId = fieldId(nodeManager, "name")

    edit(store, "name")
    configuration.setConfig({ schemaConfig: { labelWidth: "120px" } }, (next) => {
      compiler.setConfig(next)
      reconciler.refresh()
    })
    await scheduler.whenIdle()
    expect(fieldId(nodeManager, "name")).toBe(nodeId)
    expect(store.getFieldValue("name")).toBe("edited")
    expect(store.getInitialValue("name")).toBe("Alice")
    store.resetField("name")
    expect(store.getFieldValue("name")).toBe("Alice")
  })

  it("已有路径数据优先于 Schema 默认值，不依赖具体分配的 ID", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, nodeManager, reconciler, schemas } = setup([
      { name: "name", label: "姓名", componentType: "input", initialValue: "Schema" },
    ])

    store.setInitialValue("name", "Form")
    store.setFieldValue("name", "Form")
    reconciler.reconcile(schemas.peek())
    expect(store.getFieldValue("name")).toBe("Form")
    expect(store.getInitialValue("name")).toBe("Form")
    expect(nodeManager.getPath(fieldId(nodeManager, "name"))).toBe("name")
  })

  it("函数默认值作为普通值保存，不作为 Store updater 执行", () => {
    const initialValue = vi.fn(() => "value")

    // 用例直接持有需要验证和清理的运行模块。
    const { store, reconciler, schemas } = setup([
      { name: "callback", label: "回调", componentType: "input", initialValue },
    ])

    reconciler.reconcile(schemas.peek())
    expect(initialValue).not.toHaveBeenCalled()
    expect(store.getFieldValue("callback")).toBe(initialValue)
    expect(store.getInitialValue("callback")).toBe(initialValue)
  })

  it.each([true, false])(
    "稳定 key 改名保留 NodeId，读取目标路径并遵循旧 preserve=%s",
    async (preserve) => {
      // preserve 为旧 Schema 的值保留策略，新 Schema 不覆盖该策略。
      const { store, schemas, validation, nodeManager, scheduler, reconciler } = setup([
        { key: "stable", name: "name", label: "姓名", componentType: "input", preserve },
      ])

      store.setInitialValues({ name: "Alice", nickname: "Target" })
      store.setFieldsValue({ name: "Alice", nickname: "Target" })
      reconciler.reconcile(schemas.peek())
      await scheduler.whenIdle()

      // 节点身份和旧路径的校验配置分别验证。
      const nodeId = fieldId(nodeManager, "name")

      const removeField = vi.spyOn(validation, "removeField")

      edit(store, "name")
      store.setFieldPending("name", true)
      schemas.update(() => [
        { key: "stable", name: "nickname", label: "昵称", componentType: "input" },
      ])
      await scheduler.whenIdle()
      expect(nodeManager.getNodeIds("name")).toEqual([])
      expect(fieldId(nodeManager, "nickname")).toBe(nodeId)
      expect(nodeManager.getPath(nodeId)).toBe("nickname")
      expect(nodeManager.get(nodeId)).toMatchObject({
        type: "field",
        resolvedSchema: { value: { label: "昵称" } },
      })
      expect(store.getFieldsValue()).toEqual(
        preserve ? { name: "edited", nickname: "Target" } : { nickname: "Target" }
      )
      expect(store.getInitialValue("name")).toBe("Alice")
      expect(store.isFieldTouched("name")).toBe(preserve)
      expect(store.isFieldPending("name")).toBe(preserve)
      expect(store.isFieldTouched("nickname")).toBe(false)
      expect(removeField).toHaveBeenCalledWith("name")
    }
  )

  it("公开兜底规则随当前路径选择，规则工厂仍接收 NamePath 元数据", async () => {
    const original = vi.fn(() => ({
      validate: () => ({
        valid: false as const,
        issues: [{ message: "原规则" }] as const,
      }),
    }))

    const renamed = vi.fn(() => ({
      validate: () => ({
        valid: false as const,
        issues: [{ message: "新规则" }] as const,
      }),
    }))

    // 用例直接持有需要验证和清理的运行模块。
    const { store, schemas, validation, nodeManager, scheduler, reconciler } = setup(
      [{ key: "stable", name: "name", label: "姓名", componentType: "input" }],
      { fieldRules: { name: original, nickname: renamed } }
    )

    reconciler.reconcile(schemas.peek())
    await scheduler.whenIdle()

    const nodeId = fieldId(nodeManager, "name")

    await validation.validateField("name", store.getFieldsSnapshot())
    expect(original).toHaveBeenCalledWith({
      name: "name",
      label: "姓名",
      placeholder: "请输入姓名",
      required: false,
    })
    schemas.update(() => [
      { key: "stable", name: "nickname", label: "昵称", componentType: "input" },
    ])
    await scheduler.whenIdle()
    expect(fieldId(nodeManager, "nickname")).toBe(nodeId)
    await expect(
      validation.validateField("nickname", store.getFieldsSnapshot())
    ).resolves.toMatchObject({
      errors: [{ name: "nickname", issues: [{ message: "新规则" }] }],
    })
    expect(renamed).toHaveBeenCalledWith({
      name: "nickname",
      label: "昵称",
      placeholder: "请输入昵称",
      required: false,
    })
  })

  it.each(["rename", "remove"] as const)(
    "%s 时取消旧异步校验，晚到结果不写回",
    async (action) => {
      // action 决定改名或卸载；用例显式控制旧规则完成时间。
      let finish: (result: ValidationRuleResult) => void = () => {}

      const pending = new Promise<ValidationRuleResult>((resolve) => {
        // resolve 用于在路径失效后交付旧校验结果。
        finish = resolve
      })

      // 用例直接持有需要验证和清理的运行模块。
      const { store, schemas, validation, scheduler, reconciler } = setup([
        {
          key: "stable",
          name: "name",
          label: "姓名",
          componentType: "input",
          rules: { validate: () => pending },
        },
      ])

      reconciler.reconcile(schemas.peek())
      await scheduler.whenIdle()

      const result = validation.validateField("name", store.getFieldsSnapshot())

      // fields 为当前 Schema，保留 key 的改名应复用节点身份。
      schemas.update((fields) =>
        action === "remove" ? [] : fields.map((field) => ({ ...field, name: "nickname" }))
      )
      await expect(result).resolves.toMatchObject({ cancelled: true })
      finish({ valid: false, issues: [{ message: "旧错误" }] })
      await scheduler.whenIdle()
      expect(store.getFieldErrors("name")).toEqual([])
      expect(store.getFieldErrors("nickname")).toEqual([])
    }
  )

  it("隐藏只暂停校验，恢复显示后同路径的手动规则仍生效", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, schemas, validation, scheduler, reconciler } = setup([
      { key: "stable", name: "name", label: "姓名", componentType: "input" },
    ])

    reconciler.reconcile(schemas.peek())
    await scheduler.whenIdle()

    const validate = vi.fn(() => ({
      valid: false as const,
      issues: [{ message: "手动规则" }] as const,
    }))

    validation.setManualFieldRules("name", { validate })
    // fields 为当前 Schema；仅修改可见性，不改变路径和身份。
    schemas.update((fields) => fields.map((field) => ({ ...field, visible: false })))
    await scheduler.whenIdle()
    await validation.validateField("name", store.getFieldsSnapshot())
    expect(validate).not.toHaveBeenCalled()
    schemas.update((fields) => fields.map((field) => ({ ...field, visible: true })))
    await scheduler.whenIdle()
    await expect(
      validation.validateField("name", store.getFieldsSnapshot())
    ).resolves.toMatchObject({
      errors: [{ name: "name", issues: [{ message: "手动规则" }] }],
    })
  })

  it("preserve:false 卸载时删除当前值和状态，保留初始值并注销节点路径", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, schemas, nodeManager, scheduler, reconciler } = setup([
      {
        name: "name",
        label: "姓名",
        componentType: "input",
        preserve: false,
        initialValue: "Alice",
        required: true,
      },
    ])

    reconciler.reconcile(schemas.peek())
    await scheduler.whenIdle()

    const nodeId = fieldId(nodeManager, "name")

    edit(store, "name")
    schemas.update(() => [])
    expect(store.getFieldValue("name")).toBeUndefined()
    expect(store.getInitialValue("name")).toBe("Alice")
    expect(store.isFieldTouched("name")).toBe(false)
    expect(nodeManager.getPath(nodeId)).toBeUndefined()
    expect(nodeManager.getNodeIds("name")).toEqual([])
    store.resetField("name")
    expect(store.getFieldValue("name")).toBe("Alice")
  })

  it("默认保留路径数据，重新挂载分配新 ID，不复制或丢失数据", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, schemas, validation, nodeManager, scheduler, reconciler } = setup([
      { name: "name", label: "姓名", componentType: "input", initialValue: "Alice" },
    ])

    const removeField = vi.spyOn(validation, "removeField")

    reconciler.reconcile(schemas.peek())

    const previousId = fieldId(nodeManager, "name")

    edit(store, "name")
    schemas.update(() => [])
    expect(removeField).toHaveBeenCalledWith("name")
    expect(nodeManager.getNodeIds("name")).toEqual([])
    expect(nodeManager.getPath(previousId)).toBeUndefined()
    expect(store.getFieldValue("name")).toBe("edited")
    schemas.update(() => [
      { name: "name", label: "姓名", componentType: "input", initialValue: "新的默认值" },
    ])

    const nextId = fieldId(nodeManager, "name")

    expect(nextId).not.toBe(previousId)
    expect(store.getFieldValue("name")).toBe("edited")
    expect(store.getInitialValue("name")).toBe("Alice")
    expect(store.isFieldTouched("name")).toBe(true)
    await scheduler.whenIdle()
  })

  it("同路径替换旧节点，不删除新节点的值、注册和校验配置", async () => {
    // 旧规则在新节点接管同一路径后才返回失败结果。
    let finish: (result: ValidationRuleResult) => void = () => {}

    const pending = new Promise<ValidationRuleResult>((resolve) => {
      // resolve 交付旧节点的过期结果。
      finish = resolve
    })

    // 用例直接持有需要验证和清理的运行模块。
    const { store, schemas, validation, nodeManager, scheduler, reconciler } = setup([
      {
        key: "old",
        name: "name",
        label: "旧姓名",
        componentType: "input",
        preserve: false,
        rules: { validate: () => pending },
      },
    ])

    reconciler.reconcile(schemas.peek())
    await scheduler.whenIdle()

    const previousId = fieldId(nodeManager, "name")

    const removeField = vi.spyOn(validation, "removeField")

    edit(store, "name")

    const oldResult = validation.validateField("name", store.getFieldsSnapshot())

    schemas.update(() => [
      {
        key: "new",
        name: "name",
        label: "新姓名",
        componentType: "input",
        rules: {
          validate: () => ({ valid: false, issues: [{ message: "新规则" }] }),
        },
      },
    ])
    await scheduler.whenIdle()
    await expect(oldResult).resolves.toMatchObject({ cancelled: true })
    expect(fieldId(nodeManager, "name")).not.toBe(previousId)
    expect(nodeManager.getPath(previousId)).toBeUndefined()
    expect(store.getFieldsSnapshot()).toEqual({ name: "edited" })
    expect(removeField).not.toHaveBeenCalled()
    await expect(
      validation.validateField("name", store.getFieldsSnapshot())
    ).resolves.toMatchObject({
      errors: [{ name: "name", issues: [{ message: "新规则" }] }],
    })
    finish({ valid: false, issues: [{ message: "旧错误" }] })
    await scheduler.whenIdle()
    expect(store.getFieldErrors("name")[0]?.message).toBe("新规则")
  })

  it.each(["remove", "rename"] as const)(
    "前一 Group 的字段 %s 后，后一 Group 接管旧路径时保留已有值",
    (action) => {
      // action 覆盖卸载清理和改名清理，两者都必须等待兄弟 Group 完成协调。
      const { store, schemas, nodeManager, reconciler } = setup([
        {
          key: "left",
          label: "左组",
          children: [
            {
              key: "old",
              name: "name",
              label: "姓名",
              componentType: "input",
              preserve: false,
            },
          ],
        },
        { key: "right", label: "右组", children: [] },
      ])

      store.setInitialValue("name", "initial")
      reconciler.reconcile(schemas.peek())
      edit(store, "name")

      // 原节点身份只在改名时保留，新 Group 中的字段应创建独立身份。
      const previousId = fieldId(nodeManager, "name")

      // fields 替换整棵根 Schema，确保两个 Group 属于同一次提交。
      schemas.update(() => [
        {
          key: "left",
          label: "左组",
          children:
            action === "rename"
              ? [
                  {
                    key: "old",
                    name: "nickname",
                    label: "昵称",
                    componentType: "input",
                    preserve: false,
                  },
                ]
              : [],
        },
        {
          key: "right",
          label: "右组",
          children: [
            {
              key: "new",
              name: "name",
              label: "姓名",
              componentType: "input",
              initialValue: "fallback",
              preserve: false,
            },
          ],
        },
      ])

      expect(nodeManager.getPath(previousId)).toBe(
        action === "rename" ? "nickname" : undefined
      )
      expect(fieldId(nodeManager, "name")).not.toBe(previousId)
      expect(store.getFieldValue("name")).toBe("edited")
      expect(store.isFieldTouched("name")).toBe(true)
      expect(store.getInitialValue("name")).toBe("initial")

      schemas.update(() => [])
      expect(store.getFieldValue("name")).toBeUndefined()
      expect(store.isFieldTouched("name")).toBe(false)
      expect(store.getInitialValue("name")).toBe("initial")
    }
  )

  it("两个字段交换路径时保留各自身份，不按 preserve 误删值或新规则", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, schemas, validation, nodeManager, scheduler, reconciler } = setup([
      {
        key: "first",
        name: "name",
        label: "姓名",
        componentType: "input",
        preserve: false,
        required: true,
      },
      {
        key: "second",
        name: "nickname",
        label: "昵称",
        componentType: "input",
        preserve: false,
      },
    ])

    store.setFieldsValue({ name: "", nickname: "Alias" })
    reconciler.reconcile(schemas.peek())
    await scheduler.whenIdle()

    const firstId = fieldId(nodeManager, "name")

    const secondId = fieldId(nodeManager, "nickname")

    schemas.update(() => [
      {
        key: "first",
        name: "nickname",
        label: "姓名",
        componentType: "input",
        preserve: false,
        required: true,
      },
      {
        key: "second",
        name: "name",
        label: "昵称",
        componentType: "input",
        preserve: false,
      },
    ])
    await scheduler.whenIdle()
    expect(fieldId(nodeManager, "name")).toBe(secondId)
    expect(fieldId(nodeManager, "nickname")).toBe(firstId)
    expect(store.getFieldsValue()).toEqual({ name: "", nickname: "Alias" })
    store.setFieldValue("nickname", "")
    await expect(
      validation.validateField("nickname", store.getFieldsSnapshot())
    ).resolves.toMatchObject({ valid: false, errors: [{ name: "nickname" }] })
    await expect(
      validation.validateField("name", store.getFieldsSnapshot())
    ).resolves.toMatchObject({ valid: true })
  })

  it("路径订阅和旧路径取消回调都只观察到与节点索引一致的地址", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { schemas, nodeManager, reconciler } = setup([
      { key: "stable", name: "name", label: "姓名", componentType: "input" },
    ])

    reconciler.reconcile(schemas.peek())

    const nodeId = fieldId(nodeManager, "name")

    // 中止旧路径的同步回调也必须读取新地址及其索引。
    const node = nodeManager.get(nodeId)

    const cancelled = vi.fn(() => [
      nodeManager.getPath(nodeId),
      nodeManager.getNodeIds("nickname"),
    ])

    if (!isFieldNode(node)) {
      throw new Error("Expected field node")
    }

    node.pathController.signal.addEventListener("abort", cancelled)

    // 每次路径变更同时按新地址查询身份，不能观察到旧索引。
    const paths: unknown[] = []

    const dispose = createSignalEffect(() => {
      const path = nodeManager.getPath(nodeId)

      paths.push([path, path === undefined ? [] : nodeManager.getNodeIds(path)])
    })

    try {
      schemas.update(() => [
        { key: "stable", name: "nickname", label: "昵称", componentType: "input" },
      ])
      expect(paths).toEqual([
        ["name", [nodeId]],
        ["nickname", [nodeId]],
      ])
      expect(cancelled).toHaveBeenCalledTimes(1)
      expect(cancelled.mock.results[0]?.value).toEqual(["nickname", [nodeId]])
    } finally {
      dispose()
    }
  })
})
