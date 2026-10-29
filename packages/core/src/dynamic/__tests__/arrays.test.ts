import { get } from "es-toolkit/compat"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { createSchemaCompiler } from "../../compiler"
import { createFormConfig } from "../../config/createFormConfig"
import { createSchemas } from "../../createSchemas"
import { createLifecycle } from "../../lifecycle"
import { createNodeManager, createScope, isDynamicNode } from "../../node"
import { createSignal, createSignalEffect } from "../../reactivity"
import { createReconciler } from "../../reconciler"
import { createScheduler } from "../../scheduler"
import { createStore } from "../../store"
import { createValidator } from "../../validator"

import type { NodeManager } from "../../node"
import type { Signal } from "../../reactivity"
import type { FormRuntimeContext } from "../../runtimeContext"
import type {
  FieldValue,
  SchemxDynamicItemSchema,
  SchemxFormApi,
  Values,
} from "../../types"
import type { ValidationRuleResult } from "../../validator/types"

/**
 * 数组用例可替换行模板、增加另一个数组或触发异步 Dependency。
 */
interface ArrayOptions {
  readonly item?: SchemxDynamicItemSchema<Values>[]
  readonly extraArray?: boolean
  readonly mode?: Signal<string>
}

// 每个用例释放 Runtime、Validator 和路径 Store。
const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup()
  }
})

/**
 * 组合真实 NamePath Store、Validator 和数组 Runtime，不提供 ID Store 兼容接口。
 * @param users - users 路径的初始数组。
 * @param options - 行模板及可选的另一个数组、依赖信号。
 */
function setup(users: unknown[], options: ArrayOptions = {}) {
  // 本用例持有并更新的 Schema source。
  const schemas = createSchemas<Values>([
    {
      key: "users",
      name: "users",
      item: options.item ?? [{ name: "name", label: "姓名", componentType: "input" }],
    },
    ...(options.extraArray
      ? [
          {
            key: "others",
            name: "others",
            item: [{ name: "name", label: "姓名", componentType: "input" }],
          },
        ]
      : []),
  ])

  // 数组配置刷新与 Runtime 读取共用同一个配置模型。
  const configuration = createFormConfig()

  // 测试直接持有路径状态与运行资源，不构造 engine 门面。
  const scope = createScope()

  scope.add(configuration.dispose)

  // 用例使用的真实路径值和字段状态。
  const store = createStore<Values>({
    initialValues: { users, ...(options.extraArray ? { others: users } : {}) },
  })

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

  // 行快照直接来自 Store；mode 只作为用例控制的依赖输入。
  const snapshot = () => ({
    ...store.getFieldsSnapshot(),
    mode: options.mode?.value ?? "fast",
  })

  // name 为公开路径；分支仅补充 mode 输入，断言保留 getter 的路径泛型。
  const read: SchemxFormApi["getFieldValue"] = (name) =>
    (name === "mode" ? (options.mode?.value ?? "fast") : store.getFieldValue(name)) as
      FieldValue<Values, typeof name> | undefined

  // 供数组依赖读取路径值及 mode 的消费端 API 子集。
  const instance: Pick<
    SchemxFormApi,
    "getFieldsSnapshot" | "getFieldsValue" | "getFieldValue"
  > = {
    getFieldsSnapshot: snapshot,
    // names 是 Dependency 订阅的完整表单路径。
    getFieldsValue: (names?: string[]) =>
      names
        ? Object.fromEntries(names.map((name) => [name, get(snapshot(), name)]))
        : snapshot(),
    getFieldValue: read,
  }

  // 直接向节点模块提供同一组资源和消费端 API。
  const context: FormRuntimeContext = {
    debug: false,
    fieldRules: {},
    store,
    validator: validation,
    nodeManager,
    scheduler,
    formApi: instance as SchemxFormApi,
  }

  // 实际提交本用例的节点更新。
  const reconciler = createReconciler({ compiler, context, lifecycle: createLifecycle() })

  scope.add(reconciler.clear)
  scope.add(
    schemas.subscribe((next) => {
      // next 是数组模板或依赖配置更新后的根 Schema。
      reconciler.reconcile(next)
    })
  )
  scope.add(() => {
    root.disposed.value = true
  })
  cleanups.push(scope.dispose)
  reconciler.reconcile(schemas.peek())

  // 首次协调生成的真实数组节点。
  const node = nodeManager.getRoot().childNodes.peek()[0]

  if (!isDynamicNode(node)) {
    throw new Error("数组节点未挂载")
  }

  return {
    store,
    validation,
    nodeManager,
    compiler,
    reconciler,
    scheduler,
    node,
    schemas,
    configuration,
  }
}

/**
 * 通过当前路径取得活动节点身份，只用于 Runtime 身份断言。
 * @param nodeManager - 当前数组测试的节点索引。
 * @param path - 要查询的业务路径。
 */
function fieldId(nodeManager: NodeManager, path: string): number {
  const [id] = nodeManager.getNodeIds(path)

  if (id === undefined) {
    throw new Error(`字段未挂载: ${path}`)
  }

  return id
}

describe("Dynamic 的 Store 行 key 与 Runtime 身份", () => {
  it("重排与配置刷新复用身份，仅新增行和字段消耗新 ID", () => {
    // 保留原项对象引用，Store 通过行 key 识别重排。
    const { node, configuration, nodeManager, compiler, reconciler, store } = setup([
      { name: "Ada" },
      { name: "Grace" },
    ])

    // 当前所有真实身份的上界不包含临时编译结果。
    const lastId = Math.max(
      node.id,
      ...node.dynamicRows.peek().map((row) => row.id),
      ...node.childNodes.peek().map((child) => child.id)
    )

    // items 为 Store 当前数组的浅拷贝。
    store.setFieldValue(node.compiledSchema.peek().name, (items: unknown[] | undefined) =>
      items?.slice().reverse()
    )
    configuration.setConfig({ schemaConfig: { readonly: true } }, (next) => {
      compiler.setConfig(next)
      reconciler.refresh()
    })
    // items 保留原行，并追加一个全新项。
    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: unknown[] | undefined) => [...(items ?? []), { name: "Lin" }]
    )

    expect(node.dynamicRows.peek()[2]?.id).toBe(lastId + 1)
    expect(fieldId(nodeManager, "users.2.name")).toBe(lastId + 2)
  })

  it("行和字段共用 ID 序列，行结构只保存身份和位置", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([{ name: "Ada" }])

    const row = node.dynamicRows.peek()[0]

    const id = fieldId(nodeManager, "users.0.name")

    expect(row).toMatchObject({ index: 0, path: "users.0" })
    expect(row).not.toHaveProperty("value")
    expect(row).not.toHaveProperty("initialValue")
    expect(new Set([node.id, row?.id, id]).size).toBe(3)
    expect(nodeManager.getNodeIds("users.0")).toEqual([row?.id])
    expect(store.getFieldsValue()).toEqual({ users: [{ name: "Ada" }] })
  })

  it("追加、删除、移动和交换均按 Store key 复用行与字段身份", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([{ name: "Ada" }, { name: "Grace" }])

    const rows = node.dynamicRows.peek()

    const first = fieldId(nodeManager, "users.0.name")

    const second = fieldId(nodeManager, "users.1.name")

    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: { name: string }[] | undefined) => [...(items ?? []), { name: "Lin" }]
    )

    const added = node.dynamicRows.peek()[2]?.id

    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: unknown[] | undefined) => [items?.[2], items?.[1], items?.[0]]
    )
    expect(node.dynamicRows.peek().map((row) => row.id)).toEqual([
      added,
      rows[1]?.id,
      rows[0]?.id,
    ])
    expect(fieldId(nodeManager, "users.1.name")).toBe(second)
    expect(fieldId(nodeManager, "users.2.name")).toBe(first)

    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: unknown[] | undefined) => [items?.[2], items?.[1]]
    )
    expect(node.dynamicRows.peek().map((row) => row.id)).toEqual(
      rows.map((row) => row.id)
    )
    expect(nodeManager.getPath(added ?? -1)).toBeUndefined()
    expect(store.getFieldValue("users")).toEqual([{ name: "Ada" }, { name: "Grace" }])

    store.setFieldValue(node.compiledSchema.peek().name, (items: unknown[] | undefined) =>
      [...(items ?? [])].reverse()
    )
    expect(fieldId(nodeManager, "users.0.name")).toBe(second)
    expect(fieldId(nodeManager, "users.1.name")).toBe(first)
  })

  it("内容相同的新对象使用新身份，不继承旧行的状态", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([{ name: "Ada" }])

    const previous = node.dynamicRows.peek()[0]?.id

    const oldField = fieldId(nodeManager, "users.0.name")

    store.setFieldTouched("users.0.name", true)
    store.setFieldValue(node.compiledSchema.peek().name, [{ name: "Ada" }])
    expect(node.dynamicRows.peek()[0]?.id).not.toBe(previous)
    expect(nodeManager.getPath(oldField)).toBeUndefined()
    expect(store.isFieldTouched("users.0.name")).toBe(false)
    store.setFieldValue(node.compiledSchema.peek().name, [{}])
    expect(store.getFieldValue("users.0.name")).toBeUndefined()
  })

  it("重排 updater 只执行一次，Store 仍按旧顺序匹配 key", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { node, store } = setup([{ name: "Ada" }, { name: "Grace" }])

    const ids = node.dynamicRows.peek().map((row) => row.id)

    let calls = 0

    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: { name: string }[] | undefined) => {
        // 先复制再 reverse，保留 Store 用于匹配行 key 的旧数组。
        calls += 1

        return items?.slice().reverse()
      }
    )
    expect(calls).toBe(1)
    expect(node.dynamicRows.peek().map((row) => row.id)).toEqual([...ids].reverse())
  })

  it("重复引用、重复原始值和稀疏数组使用 Store 唯一的行 key", () => {
    const shared = { name: "Ada" }

    // 用例直接持有需要验证和清理的运行模块。
    const { store, node } = setup([shared, shared, "x", "x"], { item: [] })

    const previous = node.dynamicRows.peek().map((row) => row.id)

    const items = store.getFieldValue("users") as unknown[]

    store.setFieldValue(node.compiledSchema.peek().name, [
      items[2],
      items[0],
      items[3],
      items[1],
    ])
    expect(node.dynamicRows.peek().map((row) => row.id)).toEqual([
      previous[2],
      previous[0],
      previous[3],
      previous[1],
    ])
    expect(new Set(node.dynamicRows.peek().map((row) => row.id)).size).toBe(4)

    const sparse: unknown[] = []

    sparse.length = 3

    store.setFieldValue(node.compiledSchema.peek().name, sparse)
    expect(node.dynamicRows.peek().map((row) => row.index)).toEqual([0, 1, 2])
  })

  it("追加保留旧字段状态，重排只清理受影响索引的 touched、pending 和错误", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, validation, node, scheduler } = setup([
      { name: "Ada" },
      { name: "Grace" },
      { name: "Lin" },
    ])

    await scheduler.whenIdle()

    const invalidate = vi.spyOn(validation, "invalidateFieldArray")

    for (const index of [0, 1, 2]) {
      store.setFieldTouched(`users.${index}.name`, true)
      store.setFieldPending(`users.${index}.name`, true, "保存中")
      store.setFieldErrors(`users.${index}.name`, [
        { type: "validation", message: "保留" },
      ])
    }

    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: { name: string }[] | undefined) => [...(items ?? []), { name: "Extra" }]
    )
    await scheduler.whenIdle()
    expect(invalidate).toHaveBeenLastCalledWith(
      "users",
      expect.objectContaining({
        ranges: [{ start: 3, end: 3 }],
      })
    )
    expect(store.getFieldErrors("users.0.name")).toHaveLength(1)
    expect(store.isFieldTouched("users.0.name")).toBe(true)
    expect(store.isFieldPending("users.0.name")).toBe(true)

    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: unknown[] | undefined) => [items?.[0], items?.[2], items?.[1], items?.[3]]
    )
    await scheduler.whenIdle()
    expect(invalidate).toHaveBeenLastCalledWith(
      "users",
      expect.objectContaining({
        ranges: [{ start: 1, end: 2 }],
      })
    )
    expect(store.getFieldErrors("users.0.name")).toHaveLength(1)
    expect(store.isFieldTouched("users.0.name")).toBe(true)
    expect(store.isFieldPending("users.0.name")).toBe(true)
    expect(store.getFieldErrors("users.1.name")).toEqual([])
    expect(store.getFieldErrors("users.2.name")).toEqual([])
    for (const index of [1, 2]) {
      expect(store.isFieldTouched(`users.${index}.name`)).toBe(false)
      expect(store.isFieldPending(`users.${index}.name`)).toBe(false)
    }
  })

  it("行内编辑直接更新根值，移动后保留身份和未配置属性", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([
      { name: "Ada", age: 36 },
      { name: "Grace", age: 40 },
    ])

    const id = fieldId(nodeManager, "users.0.name")

    const rowId = node.dynamicRows.peek()[0]?.id

    store.setFieldValue("users.0.name", "Edited")
    expect(store.getFieldValue("users")).toEqual([
      { name: "Edited", age: 36 },
      { name: "Grace", age: 40 },
    ])
    store.setFieldValue(node.compiledSchema.peek().name, (items: unknown[] | undefined) =>
      [...(items ?? [])].reverse()
    )
    expect(node.dynamicRows.peek()[1]?.id).toBe(rowId)
    expect(fieldId(nodeManager, "users.1.name")).toBe(id)
    expect(store.getFieldValue("users.1.name")).toBe("Edited")
  })

  it("两个数组可拥有相同行 key，但 NodeId 不冲突且重置互不影响", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([{ name: "Ada" }], { extraArray: true })

    const other = nodeManager.getRoot().childNodes.peek()[1]

    if (!isDynamicNode(other)) {
      throw new Error("第二个数组未挂载")
    }

    const previous = node.dynamicRows.peek()[0]

    const otherRow = other.dynamicRows.peek()[0]

    expect(previous?.key).toBe(otherRow?.key)
    expect(previous?.id).not.toBe(otherRow?.id)
    store.setFieldValue("users.0.name", "Edited")
    store.resetField("users.0.name")
    expect(node.dynamicRows.peek()[0]?.id).toBe(previous?.id)
    store.resetField(node.compiledSchema.peek().name)
    expect(node.dynamicRows.peek()[0]?.id).not.toBe(previous?.id)
    expect(other.dynamicRows.peek()[0]?.id).toBe(otherRow?.id)
    expect(nodeManager.getPath(previous?.id ?? -1)).toBeUndefined()
    expect(store.getFieldValue("users.0.name")).toBe("Ada")
  })

  it("setFieldsValue 在外部消费者收到通知前完成全部路径交换", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([{ name: "Ada" }, { name: "Grace" }])

    const first = fieldId(nodeManager, "users.0.name")

    const second = fieldId(nodeManager, "users.1.name")

    const samples: unknown[] = []

    const stop = createSignalEffect(() => {
      void store.getFieldValue("users")
      samples.push([
        nodeManager.getPath(first),
        nodeManager.getPath(second),
        fieldId(nodeManager, "users.0.name"),
        fieldId(nodeManager, "users.1.name"),
        store.getFieldValue("users.0.name"),
        store.getFieldValue("users.1.name"),
      ])
    })

    try {
      // items 为当前 Store 数组，批量更新也复用相同的结构提交入口。
      const items = store.getFieldValue("users") as unknown[]

      store.setFieldsValue({ users: [...items].reverse() })
      expect(node.dynamicRows.peek()).toHaveLength(2)
      expect(samples).toEqual([
        ["users.0.name", "users.1.name", first, second, "Ada", "Grace"],
        ["users.1.name", "users.0.name", second, first, "Grace", "Ada"],
      ])
    } finally {
      stop()
    }
  })

  it("Group 的父子路径共享同一行数据，写整行不会分配新行身份", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([{ profile: { name: "Ada", age: 36 } }], {
      item: [
        {
          label: "资料",
          children: [
            { name: "profile", label: "资料", componentType: "input" },
            { name: "profile.name", label: "姓名", componentType: "input" },
          ],
        },
      ],
    })

    const rowId = node.dynamicRows.peek()[0]?.id

    const child = fieldId(nodeManager, "users.0.profile.name")

    store.setFieldValue("users.0.profile.name", "Edited")
    expect(store.getFieldValue("users.0.profile")).toEqual({ name: "Edited", age: 36 })
    expect(node.dynamicRows.peek()[0]?.id).toBe(rowId)
    store.setFieldValue("users.0", { profile: { name: "Whole row", age: 50 } })
    expect(store.getFieldValue("users.0.profile.name")).toBe("Whole row")
    expect(fieldId(nodeManager, "users.0.profile.name")).toBe(child)
    expect(node.dynamicRows.peek()[0]?.id).toBe(rowId)
  })

  it("完整 Store reset 重建行身份，卸载后只保留路径数据且不再响应结构变化", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, schemas, nodeManager } = setup([{ name: "Ada" }])

    const previous = node.dynamicRows.peek()[0]?.id

    store.setFieldValue(node.compiledSchema.peek().name, [{ name: "Changed" }])
    store.reset()
    expect(node.dynamicRows.peek()[0]?.id).not.toBe(previous)
    expect(store.getFieldValue("users.0.name")).toBe("Ada")

    const rows = node.dynamicRows.peek()

    const field = fieldId(nodeManager, "users.0.name")

    schemas.update(() => [])
    expect(nodeManager.getPath(field)).toBeUndefined()
    expect(rows.map((row) => nodeManager.getPath(row.id))).toEqual([undefined])
    expect(store.getFieldValue("users")).toEqual([{ name: "Ada" }])
    store.setFieldValue("users", [{ name: "Late" }])
    expect(nodeManager.getNodeIds("users.0.name")).toEqual([])
  })

  it("删除数组根清空行和后代身份，重新写入不会复用已删除的 ID", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager } = setup([{ name: "Ada" }])

    const row = node.dynamicRows.peek()[0]?.id

    const field = fieldId(nodeManager, "users.0.name")

    store.removeFieldValue("users")
    expect(node.dynamicRows.peek()).toEqual([])
    expect(nodeManager.getNodeIds("users.0.name")).toEqual([])
    expect(nodeManager.getPath(row ?? -1)).toBeUndefined()
    expect(nodeManager.getPath(field)).toBeUndefined()
    expect(store.getFieldsValue()).toEqual({})
    store.setFieldValue("users", [{ name: "New" }])
    expect(node.dynamicRows.peek()[0]?.id).not.toBe(row)
    expect(fieldId(nodeManager, "users.0.name")).not.toBe(field)
    expect(store.getFieldValue("users.0.name")).toBe("New")
  })

  it("模板刷新和数组改名复用同容器的行 key，数据读取目标路径", () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, schemas, nodeManager } = setup([{ name: "Ada" }])

    const row = node.dynamicRows.peek()[0]?.id

    const field = fieldId(nodeManager, "users.0.name")

    schemas.update(() => [
      {
        key: "users",
        name: "users",
        item: [{ name: "name", label: "新姓名", componentType: "input" }],
      },
    ])
    expect(node.dynamicRows.peek()[0]?.id).toBe(row)
    expect(fieldId(nodeManager, "users.0.name")).toBe(field)

    store.setFieldValue("members", [{ name: "Target" }])
    schemas.update(() => [
      {
        key: "users",
        name: "members",
        item: [{ name: "name", label: "新姓名", componentType: "input" }],
      },
    ])
    expect(node.dynamicRows.peek()[0]?.id).toBe(row)
    expect(fieldId(nodeManager, "members.0.name")).toBe(field)
    expect(nodeManager.getPath(row ?? -1)).toBe("members.0")
    expect(nodeManager.getNodeIds("users")).toEqual([])
    expect(nodeManager.getPath(node.id)).toBe("members")
    expect(store.getFieldValue("members.0.name")).toBe("Target")
    expect(store.getFieldValue("users.0.name")).toBe("Ada")
  })

  it.each(["move", "remove"] as const)(
    "%s 后异步 Dependency 输出跟随存活行，旧结果不恢复旧路径",
    async (action) => {
      // action 区分重排和删除首行，旧 renderer 都必须失效。
      const mode = createSignal("fast")

      const pending: ((fields: SchemxDynamicItemSchema<Values>[]) => void)[] = []

      // 用例直接持有需要验证和清理的运行模块。
      const { store, node, configuration, nodeManager, scheduler, compiler, reconciler } =
        setup([{ idCard: "A" }, { idCard: "B" }], {
          mode,
          item: [
            {
              key: "dependent",
              to: ["mode"],
              renderer: (values) =>
                values.mode === "slow"
                  ? new Promise<SchemxDynamicItemSchema<Values>[]>((resolve) => {
                      // resolve 用于在移动后交付过期输出。
                      pending.push(resolve)
                    })
                  : [{ name: "idCard", label: "证件", componentType: "input" }],
            },
          ],
        })

      await scheduler.whenIdle()

      const first = fieldId(nodeManager, "users.0.idCard")

      const second = fieldId(nodeManager, "users.1.idCard")

      mode.value = "slow"
      await Promise.resolve()
      store.setFieldValue(
        node.compiledSchema.peek().name,
        (items: unknown[] | undefined) =>
          action === "move" ? [...(items ?? [])].reverse() : items?.slice(1)
      )
      expect(fieldId(nodeManager, "users.0.idCard")).toBe(second)
      if (action === "move") {
        expect(fieldId(nodeManager, "users.1.idCard")).toBe(first)
      } else {
        expect(nodeManager.getPath(first)).toBeUndefined()
      }

      expect(store.getFieldValue("users.0.idCard")).toBe("B")
      configuration.setConfig({ schemaConfig: { labelWidth: "120px" } }, (next) => {
        compiler.setConfig(next)
        reconciler.refresh()
      })
      expect(fieldId(nodeManager, "users.0.idCard")).toBe(second)
      mode.value = "fast"
      await scheduler.whenIdle()
      for (const resolve of pending) {
        resolve([{ name: "stale", label: "旧结果", componentType: "input" }])
      }

      await Promise.resolve()
      await scheduler.whenIdle()
      expect(nodeManager.getNodeIds("users.0.stale")).toEqual([])
      expect(store.getFieldValue("users.0.idCard")).toBe("B")
    }
  )

  it("行内 Dependency 重定位保留包含点号的属性路径和原字段身份", async () => {
    // renderer 生成的属性名包含点号，不能在移动时改成多级路径。
    const { node, store, nodeManager, scheduler } = setup(
      [{ "display.name": "Ada" }, { "display.name": "Grace" }],
      {
        item: [
          {
            key: "dependent",
            to: ["mode"],
            renderer: () => [
              {
                label: "资料",
                children: [
                  {
                    key: "nested",
                    to: ["mode"],
                    renderer: () => [
                      { name: '["display.name"]', label: "姓名", componentType: "input" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }
    )

    await scheduler.whenIdle()

    // 字段引用必须立即跟随原行，不能等待新的异步 renderer 提交来修正路径。
    const first = fieldId(nodeManager, 'users.0["display.name"]')

    // items 保留原行对象，通过 Store key 完成重排。
    store.setFieldValue(node.compiledSchema.peek().name, (items: unknown[] | undefined) =>
      items?.slice().reverse()
    )

    expect(nodeManager.getPath(first)).toBe('users.1["display.name"]')
    expect(fieldId(nodeManager, 'users.1["display.name"]')).toBe(first)
    expect(store.getFieldValue('users.1["display.name"]')).toBe("Ada")
    await scheduler.whenIdle()
    expect(fieldId(nodeManager, 'users.1["display.name"]')).toBe(first)
  })

  it("行内 Dependency 首次执行可读取前置字段刚写入的默认值", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { nodeManager, scheduler } = setup([{ passport: "P" }], {
      item: [
        { name: "kind", label: "类型", componentType: "input", initialValue: "passport" },
        {
          to: ["mode"],
          renderer: (_values, _form, context) => [
            {
              name: context.item.kind === "passport" ? "passport" : "idCard",
              label: "证件",
              componentType: "input",
            },
          ],
        },
      ],
    })

    await scheduler.whenIdle()
    expect(nodeManager.getNodeIds("users.0.passport")).toHaveLength(1)
    expect(nodeManager.getNodeIds("users.0.idCard")).toEqual([])
  })

  it("renderer 收到独立行快照，修改 item 不会改动 Store", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, scheduler } = setup([{ name: "Ada" }], {
      item: [
        {
          to: ["mode"],
          renderer: (_values, _form, context) => {
            // context.item 是快照，外部修改不能写入唯一路径值树。
            context.item.name = "外部修改"

            return [{ name: "name", label: "姓名", componentType: "input" }]
          },
        },
      ],
    })

    await scheduler.whenIdle()
    expect(store.getFieldValue("users")).toEqual([{ name: "Ada" }])
  })

  it("移动立即取消旧路径的异步校验，旧结果不写入新占用者", async () => {
    let finish: (result: ValidationRuleResult) => void = () => {}

    const pending = new Promise<ValidationRuleResult>((resolve) => {
      // resolve 在数组移动后才交付旧校验结果。
      finish = resolve
    })

    // 用例直接持有需要验证和清理的运行模块。
    const { store, validation, node, nodeManager, scheduler } = setup(
      [{ name: "Ada" }, { name: "Grace" }],
      {
        item: [
          {
            name: "name",
            label: "姓名",
            componentType: "input",
            rules: { validate: () => pending },
          },
        ],
      }
    )

    await scheduler.whenIdle()

    const id = fieldId(nodeManager, "users.0.name")

    const result = validation.validateField("users.0.name", store.getFieldsSnapshot())

    store.setFieldValue(node.compiledSchema.peek().name, (items: unknown[] | undefined) =>
      [...(items ?? [])].reverse()
    )
    await expect(result).resolves.toMatchObject({ cancelled: true })
    finish({ valid: false, issues: [{ message: "旧错误" }] })
    await Promise.resolve()
    expect(store.getFieldErrors("users.0.name")).toEqual([])
    expect(store.getFieldErrors("users.1.name")).toEqual([])
    expect(fieldId(nodeManager, "users.1.name")).toBe(id)
  })

  it("删除行时 preserve:false 不删除新占用行中暂未渲染的属性", async () => {
    // 用例直接持有需要验证和清理的运行模块。
    const { store, node, nodeManager, scheduler } = setup(
      [
        { show: true, secret: "A" },
        { show: false, secret: "B" },
      ],
      {
        item: [
          {
            to: ["mode"],
            renderer: (_values, _form, context) =>
              context.item.show
                ? [
                    {
                      name: "secret",
                      label: "秘密",
                      componentType: "input",
                      preserve: false,
                    },
                  ]
                : [],
          },
        ],
      }
    )

    await scheduler.whenIdle()
    expect(nodeManager.getNodeIds("users.0.secret")).toHaveLength(1)
    expect(nodeManager.getNodeIds("users.1.secret")).toEqual([])
    store.setFieldValue(
      node.compiledSchema.peek().name,
      (items: unknown[] | undefined) => [items?.[1]]
    )
    await scheduler.whenIdle()
    expect(store.getFieldValue("users")).toEqual([{ show: false, secret: "B" }])
  })
})
