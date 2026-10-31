/**
 * Reconciler 与 NodeManager 集成测试。
 *
 * 覆盖 schema 提交后的节点创建、复用、替换、索引与资源清理。
 *
 * @module core/node/__tests__/reconcilerManager.test
 */

import { describe, expect, it, vi } from "vite-plus/test"

import { isDependencyNode, isDynamicNode, isFieldNode, isGroupNode } from ".."
import * as fieldFactory from "../../field/createNode"
import { createSignalEffect } from "../../reactivity"
import * as schemaUtils from "../../utils/schema"

import { createRawFieldSchema, createRuntimeGraphHarness } from "./graphTestUtils"

import type { FieldNode } from ".."
import type { SchemxField } from "../../types"

// 验证 reconciler 通过 NodeManager 维护运行时树。
describe("RuntimeReconciler + NodeManager", () => {
  it("创建 root 时不持有额外字段索引", () => {
    const { root } = createRuntimeGraphHarness()

    expect(root.childNodes.value).toEqual([])
  })

  it("四类节点复用时保留运行资源，仅类型替换创建新节点", () => {
    // 四类原始 Schema 都具有稳定 key，数组初始为空。
    const schemas: SchemxField[] = [
      createRawFieldSchema("name", "name"),
      { key: "group", label: "分组", children: [] },
      { key: "dependency", to: ["name"], renderer: () => [] },
      { key: "items", name: "items", item: [] },
    ]

    // 先完成初次挂载，再检查复用路径中的实际分配。
    const { commitSchemas, root, compiler, reconciler } = createRuntimeGraphHarness()

    commitSchemas(root, schemas)

    // 当前节点身份和作用域应由重复提交原样复用。
    const nodes = root.childNodes.peek()

    // 配置更新保留各节点已有的 Signal 和 Scope。
    const signals = nodes.map((node) => node.compiledSchema)

    const scopes = nodes.map((node) => node.scope)

    const createNode = vi.spyOn(compiler, "createNode")

    const createScope = vi.spyOn(root.scope, "child")

    try {
      commitSchemas(root, schemas)
      commitSchemas(root, [...schemas].reverse())
      expect(root.childNodes.peek()).toEqual([...nodes].reverse())
      expect(createNode).not.toHaveBeenCalled()
      expect(createScope).not.toHaveBeenCalled()

      // schema 为原始配置；静态配置变化只替换编译结果。
      const updatedSchemas = schemas.map((schema) => ({ ...schema, readonly: true }))

      commitSchemas(root, updatedSchemas)
      expect(root.childNodes.peek()).toEqual(nodes)
      expect(root.childNodes.peek().map((node) => node.compiledSchema)).toEqual(signals)
      expect(root.childNodes.peek().map((node) => node.scope)).toEqual(scopes)
      expect(createNode).not.toHaveBeenCalled()
      expect(createScope).not.toHaveBeenCalled()

      commitSchemas(root, [
        { key: "name", label: "替换分组", children: [] },
        ...updatedSchemas.slice(1),
      ])
      expect(createNode).toHaveBeenCalledTimes(1)
      expect(createScope).toHaveBeenCalledTimes(1)
      expect(root.childNodes.peek()[0]?.id).not.toBe(nodes[0]?.id)
      expect(scopes[0]?.disposed).toBe(true)
    } finally {
      createNode.mockRestore()
      createScope.mockRestore()
      reconciler.clear()
    }
  })

  it.each(["root", "nested"] as const)(
    "%s 候选配置编译失败时不创建节点或修改当前配置",
    (location) => {
      // 当前树包含一个已有字段，后续提交将尝试更新并新增字段。
      const { commitSchemas, root, compiler, reconciler } = createRuntimeGraphHarness()

      const stable = createRawFieldSchema("stable", "stable")

      commitSchemas(root, [stable])

      // 记录编译失败前的节点和配置对象。
      const node = root.childNodes.peek()[0]

      const previousConfig = node?.compiledSchema.peek()

      const createNode = vi.spyOn(compiler, "createNode")

      const createScope = vi.spyOn(root.scope, "child")

      // 属性读取错误发生在纯编译阶段，结构校验可以正常完成。
      const failed: SchemxField = {
        ...createRawFieldSchema("failed", "failed"),
        get componentProps(): never {
          throw new Error("compile failed")
        },
      }

      try {
        expect(() =>
          commitSchemas(root, [
            { ...stable, label: "未提交的修改" },
            createRawFieldSchema("new", "new"),
            location === "nested"
              ? { key: "group", label: "分组", children: [failed] }
              : failed,
          ])
        ).toThrow("compile failed")
        expect(root.childNodes.peek()).toEqual([node])
        expect(node?.compiledSchema.peek()).toBe(previousConfig)
        expect(node?.scope.disposed).toBe(false)
        expect(createNode).not.toHaveBeenCalled()
        expect(createScope).not.toHaveBeenCalled()
      } finally {
        createNode.mockRestore()
        createScope.mockRestore()
        reconciler.clear()
      }
    }
  )

  it("节点工厂失败时释放已建节点和失败作用域，不卸载未挂载节点", () => {
    // 未挂载节点的清理只释放资源，不发布 unmounted。
    const hooks = { unmounted: vi.fn() }

    const { commitSchemas, root, reconciler } = createRuntimeGraphHarness(hooks)

    const stable = createRawFieldSchema("stable", "stable")

    commitSchemas(root, [stable])

    // 失败期间保留当前树中的活动节点。
    const previous = root.childNodes.peek()[0]

    // 第一个新增节点真实创建，第二个工厂调用抛出错误。
    const original = fieldFactory.createFieldNode

    const createField = vi
      .spyOn(fieldFactory, "createFieldNode")
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error("factory failed")
      })

    const createScope = vi.spyOn(root.scope, "child")

    try {
      expect(() =>
        commitSchemas(root, [
          stable,
          createRawFieldSchema("first", "first"),
          createRawFieldSchema("second", "second"),
        ])
      ).toThrow("factory failed")
      expect(root.childNodes.peek()).toEqual([previous])
      expect(previous?.scope.disposed).toBe(false)
      expect(createScope).toHaveBeenCalledTimes(2)
      expect(createScope.mock.results.every((result) => result.value.disposed)).toBe(true)
      expect(createField.mock.results[0]?.value.disposed.peek()).toBe(true)
      expect(hooks.unmounted).not.toHaveBeenCalled()
    } finally {
      createField.mockRestore()
      createScope.mockRestore()
      reconciler.clear()
    }
  })

  it("挂载失败时回滚已插入节点，并释放尚未挂载的新节点", () => {
    // 记录挂载失败后的资源与结构清理，不要求回滚 Store 写入。
    const { commitSchemas, root, context, compiler, reconciler } =
      createRuntimeGraphHarness()

    const stable = createRawFieldSchema("stable", "stable")

    commitSchemas(root, [stable])

    const previous = root.childNodes.peek()[0]

    // 第二个新增字段注册路径时失败，第三个节点已创建但尚未插入。
    const register = context.store.registerFieldPath.bind(context.store)

    const registerPath = vi
      .spyOn(context.store, "registerFieldPath")
      .mockImplementationOnce(register)
      .mockImplementationOnce(() => {
        throw new Error("mount failed")
      })

    const createNode = vi.spyOn(compiler, "createNode")

    try {
      expect(() =>
        commitSchemas(root, [
          stable,
          createRawFieldSchema("first", "first"),
          createRawFieldSchema("second", "second"),
          createRawFieldSchema("third", "third"),
        ])
      ).toThrow("mount failed")
      expect(root.childNodes.peek()).toEqual([previous])
      expect(previous?.scope.disposed).toBe(false)
      expect(createNode).toHaveBeenCalledTimes(3)
      // result 为 Compiler 已成功返回的真实节点，纯配置不进入此清理路径。
      for (const result of createNode.mock.results) {
        expect(result.value.scope.disposed).toBe(true)
        expect(result.value.disposed.peek()).toBe(true)
        expect(context.nodeManager.has(result.value.id)).toBe(false)
      }
    } finally {
      registerPath.mockRestore()
      createNode.mockRestore()
      reconciler.clear()
    }
  })

  it("静态 Group 子树每次提交只检查一次，独立子树提交重新检查", () => {
    // 统计入口结构校验，递归协调应复用本轮校验结果。
    const validate = vi.spyOn(schemaUtils, "isValidSchema")

    // 原始输入包含两层 Group，结构校验会自行递归其静态子树。
    const schema = {
      key: "outer",
      label: "外层",
      children: [
        {
          key: "inner",
          label: "内层",
          children: [createRawFieldSchema("name", "name")],
        },
      ],
    }

    // 独立的协调入口不能复用上一次提交的校验结果。
    const { commitSchemas, root, reconciler } = createRuntimeGraphHarness()

    try {
      commitSchemas(root, [schema])
      expect(validate).toHaveBeenCalledTimes(1)

      // 新的子树提交需要完整验证自己的输入。
      const outer = root.childNodes.peek()[0]

      if (!isGroupNode(outer)) throw new Error("外层分组未挂载")

      commitSchemas(outer, schema.children)
      expect(validate).toHaveBeenCalledTimes(2)

      commitSchemas(root, [schema])
      expect(validate).toHaveBeenCalledTimes(3)
    } finally {
      validate.mockRestore()
      reconciler.clear()
    }
  })

  it("宽字段列表更新时不逐字段查询兄弟节点列表", () => {
    // 字段数量用于暴露校验中的逐项线性查找。
    const schemas = Array.from({ length: 64 }, (_, index) =>
      createRawFieldSchema(`field-${index}`, `field${index}`)
    )

    // 先挂载已有字段，使第二次提交真正走节点复用分支。
    const { commitSchemas, root, context, reconciler } = createRuntimeGraphHarness()

    commitSchemas(root, schemas)

    // 查询次数应由提交阶段决定，不随当前父节点的字段数量增长。
    const getChildren = vi.spyOn(context.nodeManager, "getChildren")

    try {
      commitSchemas(root, schemas)
      expect(root.childNodes.peek()).toHaveLength(64)
      expect(getChildren.mock.calls.length).toBeLessThan(10)
    } finally {
      getChildren.mockRestore()
      reconciler.clear()
    }
  })

  it("数组行与子树在同一批次发布，非法子 Schema 不留下行索引", () => {
    // 使用统一协调入口提交行，资源层不直接写入 NodeManager。
    const { commitSchemas, root, reconciler, context } = createRuntimeGraphHarness()

    commitSchemas(root, [{ key: "users", name: "users", item: [] }])

    // 当前挂载的数组容器。
    const array = root.childNodes.peek()[0]

    if (!isDynamicNode(array)) {
      throw new Error("数组节点未挂载")
    }

    // 消费者同时读取行位置和字段路径，不应看到半完成的结构。
    const snapshots: unknown[] = []

    // row 为已提交行，child 为该数组展开后的字段节点。
    const stop = createSignalEffect(() => {
      snapshots.push([
        array.dynamicRows.value.map((row) => row.path),
        array.childNodes.value.map((child) =>
          isFieldNode(child) ? child.name.value : undefined
        ),
      ])
    })

    try {
      reconciler.reconcileArray(array.id, {
        keys: ["first"],
        // rows 为 Compiler 工厂创建并由 Reconciler 匹配的行；row 为当前行。
        createSchemas: (rows) =>
          rows.map((row) => createRawFieldSchema(row.key, `${row.path}.name`)),
      })
      expect(snapshots).toEqual([
        [[], []],
        [["users.0"], ["users.0.name"]],
      ])

      // 校验失败后继续保留已提交的行和子节点。
      const previousRows = array.dynamicRows.peek()

      // 同一 Schema 重复出现，使新一轮提交在静态校验阶段失败。
      const duplicate = createRawFieldSchema("duplicate", "users.1.name")

      expect(() =>
        reconciler.reconcileArray(array.id, {
          keys: ["first", "second"],
          createSchemas: () => [duplicate, duplicate],
        })
      ).toThrow("Duplicate")
      expect(array.dynamicRows.peek()).toBe(previousRows)
      expect(array.childNodes.peek()).toHaveLength(1)
      expect(context.nodeManager.getNodeIds("users.1")).toEqual([])
    } finally {
      stop()
      reconciler.clear()
    }
  })

  it("递归提交嵌套 group 子树", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [
      {
        label: "根分组",
        children: [
          {
            label: "嵌套分组",
            children: [createRawFieldSchema("field", "field")],
          },
        ],
      },
    ])

    expect(root.childNodes.value).toHaveLength(1)
    expect(
      isGroupNode(root.childNodes.value[0]) &&
        isGroupNode(root.childNodes.value[0].childNodes.value[0])
        ? root.childNodes.value[0].childNodes.value[0].childNodes.value[0]?.key
        : undefined
    ).toBe("field")
  })

  it("生命周期事件在创建、更新和移除时各触发一次", () => {
    const hooks = {
      created: vi.fn(),
      mounted: vi.fn(),
      updated: vi.fn(),
      unmounted: vi.fn(),
    }

    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    // 原样提交与配置更新都复用已创建的节点。
    const schema = createRawFieldSchema("name", "name")

    commitSchemas(root, [schema])
    commitSchemas(root, [schema])
    commitSchemas(root, [
      { ...createRawFieldSchema("name", "name"), label: "更新后的标签" },
    ])
    commitSchemas(root, [])

    expect(hooks.mounted).toHaveBeenCalledTimes(1)
    expect(hooks.updated).toHaveBeenCalledTimes(1)
    expect(hooks.unmounted).toHaveBeenCalledTimes(1)
    expect(hooks.created).toHaveBeenCalledTimes(1)
    expect(hooks.created.mock.calls.map(([node]) => node.id)).toEqual(
      hooks.mounted.mock.calls.map(([node]) => node.id)
    )
  })

  it("排序复用不触发 created，类型替换只通知实际挂载的新节点", () => {
    // 对比创建与挂载事件，排除只用于协调的 detached 节点。
    const hooks = { created: vi.fn(), mounted: vi.fn() }

    // 两个字段交换顺序时保持身份，随后将其中一个字段替换为 Group。
    const { commitSchemas, root } = createRuntimeGraphHarness(hooks)

    // 原始配置引用用于验证纯排序。
    const first = createRawFieldSchema("first", "first")

    // 第二个字段保留 key，但在最后一次提交中改变节点类型。
    const second = createRawFieldSchema("second", "second")

    commitSchemas(root, [first, second])
    commitSchemas(root, [second, first])
    expect(hooks.created).toHaveBeenCalledTimes(2)

    commitSchemas(root, [{ key: "second", label: "分组", children: [] }, first])
    expect(hooks.created).toHaveBeenCalledTimes(3)
    expect(hooks.created.mock.calls.map(([node]) => node.id)).toEqual(
      hooks.mounted.mock.calls.map(([node]) => node.id)
    )
    expect(hooks.created).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: root.childNodes.peek()[0]?.id, parentId: null })
    )
  })

  it("reconcileChildren 拒绝不存在或非容器 parent", () => {
    const { commitSchemas, reconciler, root } = createRuntimeGraphHarness()

    expect(() => reconciler.reconcileChildren(999, [])).toThrow(
      'Node "999" does not exist'
    )

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0]

    if (!field) {
      throw new Error("expected field")
    }

    expect(() => reconciler.reconcileChildren(field.id, [])).toThrow(
      `Node "${field.id}" cannot contain children`
    )
  })

  it("同名字段改 key 时移除旧节点并建立新节点", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("old", "user.name")])
    const oldNode = root.childNodes.value[0]

    commitSchemas(root, [createRawFieldSchema("new", "user.name")])
    const newNode = root.childNodes.value[0]

    expect(oldNode?.disposed.value).toBe(true)
    expect(newNode?.key).toBe("new")
    expect(isFieldNode(newNode) && newNode.name.value).toBe("user.name")
  })

  it("提交空 Schema 时清理资源并断开父子关系", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createRawFieldSchema("name", "name")])
    const field = root.childNodes.value[0] as FieldNode

    commitSchemas(root, [])

    expect(field.disposed.value).toBe(true)
    expect(field.compiledSchema.value.name).toBe("name")
    expect(field.parent).toBeNull()
  })

  it("dependency trigger 更新时复用节点并写入最新配置", () => {
    const { commitSchemas, root } = createRuntimeGraphHarness()

    commitSchemas(root, [createDependencySchema(["type"])])
    const dependency = root.childNodes.value[0]

    commitSchemas(root, [createDependencySchema(["mode"])])

    expect(root.childNodes.value[0]).toBe(dependency)
    expect(isDependencyNode(dependency) && dependency.compiledSchema.value.to).toEqual([
      "mode",
    ])
  })

  it("失败的 Schema 提交不覆盖刷新使用的最近成功快照", () => {
    const { commitSchemas, reconciler, root } = createRuntimeGraphHarness()

    const schema = createRawFieldSchema("stable", "name")

    commitSchemas(root, [schema])
    const node = root.childNodes.peek()[0]

    expect(() => commitSchemas(root, [schema, schema])).toThrow("Duplicate")
    expect(() => reconciler.refresh()).not.toThrow()
    expect(root.childNodes.peek()).toEqual([node])
    reconciler.clear()
    reconciler.refresh()
    expect(root.childNodes.peek()).toEqual([])
  })
})

function createDependencySchema(triggerFields: string[]) {
  return {
    key: "dep",
    to: triggerFields,
    renderer: () => [],
  }
}
