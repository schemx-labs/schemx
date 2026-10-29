import { describe, expect, it, vi } from "vite-plus/test"

import { createSchemaCompiler } from ".."
import { createFormConfig } from "../../config/createFormConfig"
import { isDependencyNode, isDynamicNode, isFieldNode, isGroupNode } from "../../node"
import * as nodeScope from "../../node/scope"
import * as reactivity from "../../reactivity"

import type { SchemxConfig } from "../../config"
import type { SchemxField } from "../../types"

/**
 * 创建使用真实配置快照的测试 Compiler。
 * @param options - 本次测试的共享配置。
 */
function createTestCompiler(options: SchemxConfig = {}) {
  // 测试快照没有订阅者，创建后即可释放配置模型。
  const configuration = createFormConfig({ config: options })

  const config = configuration.getConfig()

  configuration.dispose()

  return createSchemaCompiler({
    config,
  })
}

describe("createSchemaCompiler().compile", () => {
  it("编译缓存只保存配置，不创建运行资源或消耗节点身份", () => {
    // 编译器创建完成后再统计纯编译阶段的资源分配。
    const compiler = createTestCompiler()

    // 重复提交保持原始 Schema 引用和最终 key 不变。
    const schema: SchemxField = { name: "email", label: "邮箱", componentType: "input" }

    // 纯编译不应调用任何响应式或作用域工厂。
    const signal = vi.spyOn(reactivity, "createSignal")

    const computed = vi.spyOn(reactivity, "createComputed")

    const scope = vi.spyOn(nodeScope, "createScope")

    try {
      // 编译产物不包含节点运行状态。
      const compiled = compiler.compile(schema, "root", 0)

      expect(compiler.compile(schema, "root", 0)).toBe(compiled)
      expect(compiled).not.toHaveProperty("scope")
      expect(compiled).not.toHaveProperty("id")
      expect(compiled).not.toHaveProperty("type")
      expect(compiled).not.toHaveProperty("key")
      expect(compiled.schema.key).toBe("field:root/email")
      expect(signal).not.toHaveBeenCalled()
      expect(computed).not.toHaveBeenCalled()
      expect(scope).not.toHaveBeenCalled()

      // 首个真实身份仍从 1 开始，创建 Node 时才建立运行资源。
      const row = compiler.createDynamicRow({ key: "row", index: 0, path: "users.0" })

      const node = compiler.createNode(compiled, nodeScope.createScope())

      expect(row.id).toBe(1)
      expect(node.id).toBe(2)
      expect(node.compiledSchema.peek()).toBe(compiled.schema)
      node.scope.dispose()
    } finally {
      signal.mockRestore()
      computed.mockRestore()
      scope.mockRestore()
    }
  })

  it("Schema 引用、key 和默认配置变化时生成新的编译结果", () => {
    // 配置快照由配置模块生成，Compiler 只在显式替换后使用新值。
    const defaults = { readonly: false }

    const compiler = createTestCompiler({ schemaConfig: defaults })

    // 无显式 key 的 Group 随父级位置生成不同 key。
    const schema: SchemxField = { label: "分组", children: [] }

    const first = compiler.compile(schema, "first", 0)

    expect(compiler.compile(schema, "first", 1)).not.toBe(first)
    expect(compiler.compile(schema, "second", 0)).not.toBe(first)
    expect(compiler.compile({ ...schema }, "first", 0)).not.toBe(first)
    compiler.setConfig(
      createFormConfig({ config: { schemaConfig: { readonly: true } } }).getConfig()
    )

    // 失效后即使原始 Schema 和 key 相同，也重新编译默认配置。
    const refreshed = compiler.compile(schema, "first", 0)

    expect(refreshed).not.toBe(first)
    expect(refreshed.configToken).not.toBe(first.configToken)
    expect(refreshed.schema.readonly).toBe(true)
    expect(first.schema.readonly).toBe(false)
  })
})

/**
 * 验证 compiler 直接创建节点，并保留配置 token 缓存语义。
 */
describe("createSchemaCompiler().createNode", () => {
  it("节点和数组行由 Compiler 使用同一私有序列创建，刷新不重置序列", () => {
    // 同一个 Compiler 创建不同运行时身份。
    const compiler = createTestCompiler()

    // 普通字段与数组行交错创建，验证身份不会冲突或回收。
    const schema: SchemxField = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    }

    // 数组行工厂只接收行位置，不允许外部分配 ID。
    const row = compiler.createDynamicRow({ key: "row", index: 0, path: "users.0" })

    // 字段与行共享私有序列。
    const firstNode = compiler.createNode(
      compiler.compile(schema, "schemx:root", 0),
      nodeScope.createScope()
    )

    compiler.invalidateConfigCache()

    // 配置刷新之后继续分配新身份。
    const secondNode = compiler.createNode(
      compiler.compile(schema, "schemx:root", 0),
      nodeScope.createScope()
    )

    expect(row).toEqual({ id: 1, key: "row", index: 0, path: "users.0" })
    expect([firstNode.id, secondNode.id]).toEqual([2, 3])
  })

  it("未注入分配器时，Compiler 各自持有独立节点 ID 序列", () => {
    const firstCompiler = createTestCompiler()

    const secondCompiler = createTestCompiler()

    const schema: SchemxField = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    }

    expect(
      firstCompiler.createNode(
        firstCompiler.compile(schema, "schemx:root", 0),
        nodeScope.createScope()
      ).id
    ).toBe(1)
    expect(
      secondCompiler.createNode(
        secondCompiler.compile(schema, "schemx:root", 0),
        nodeScope.createScope()
      ).id
    ).toBe(1)
    expect(
      firstCompiler.createNode(
        firstCompiler.compile(schema, "schemx:root", 0),
        nodeScope.createScope()
      ).id
    ).toBe(2)
  })

  it("编译字段", () => {
    const compiler = createTestCompiler()

    const node = compiler.createNode(
      compiler.compile({ name: "email", label: "", componentType: "input" }, "", 0),
      nodeScope.createScope()
    )

    expect(node).toMatchObject({
      type: "field",
      key: "field:email",
    })

    expect(isFieldNode(node) && node.compiledSchema.value.componentType).toBe("input")
  })

  it("通用继承 schemaConfig 并保留字段显式配置", () => {
    const compiler = createTestCompiler({
      schemaConfig: {
        visible: false,
        readonly: true,
        disabled: true,
        required: true,
        labelAlign: "right",
        labelPosition: "top",
        labelWidth: "160px",
        contentAlign: "center",
        colon: false,
        showRequiredMark: false,
        validationTrigger: "onChange",
      },
    })

    const node = compiler.createNode(
      compiler.compile(
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          visible: true,
          readonly: false,
          disabled: undefined,
          labelWidth: "",
        },
        "",
        0
      ),
      nodeScope.createScope()
    )

    if (!isFieldNode(node)) {
      throw new Error("expected field node")
    }

    expect(node.compiledSchema.value).toMatchObject({
      visible: true,
      readonly: false,
      disabled: true,
      required: true,
      labelAlign: "right",
      labelPosition: "top",
      labelWidth: "",
      contentAlign: "center",
      colon: false,
      showRequiredMark: false,
      validationTrigger: ["change"],
    })
  })

  it("按 Renderer 默认值、字段 Props 和 Core 受控状态编译组件 Props", () => {
    const compiler = createTestCompiler({
      rendererProps: {
        input: {
          disabled: true,
          placeholder: "Renderer 占位",
          readonly: false,
          readonlyPlaceholder: "Renderer 空值",
        },
      },
    })

    const node = compiler.createNode(
      compiler.compile(
        {
          name: "email",
          label: "邮箱",
          componentType: "input",
          readonly: true,
          disabled: false,
          componentProps: {
            placeholder: "字段占位",
            readonlyPlaceholder: "字段空值",
          },
        },
        "",
        0
      ),
      nodeScope.createScope()
    )

    if (!isFieldNode(node)) {
      throw new Error("expected field node")
    }

    expect(node.compiledSchema.value.componentProps).toMatchObject({
      disabled: false,
      placeholder: "字段占位",
      readonly: true,
      readonlyPlaceholder: "字段空值",
      formItemProps: {
        name: "email",
        placeholder: "字段占位",
        readonly: true,
        disabled: false,
      },
    })

    const topLevelNode = compiler.createNode(
      compiler.compile(
        {
          name: "nickname",
          label: "昵称",
          componentType: "input",
          contentAlign: "center",
          placeholder: "顶层字段占位",
          readonlyPlaceholder: "顶层字段空值",
        },
        "",
        1
      ),
      nodeScope.createScope()
    )

    if (!isFieldNode(topLevelNode)) {
      throw new Error("expected field node")
    }

    expect(topLevelNode.compiledSchema.value.componentProps).toMatchObject({
      placeholder: "顶层字段占位",
      readonlyPlaceholder: "顶层字段空值",
    })
  })

  it("只按 Schema 的精确 componentType 读取 Renderer 默认 Props", () => {
    const compiler = createTestCompiler({
      rendererProps: {
        text: { placeholder: "fallback 占位" },
        unknown: { placeholder: "精确占位" },
      },
    })

    const node = compiler.createNode(
      compiler.compile(
        {
          name: "custom",
          label: "自定义",
          componentType: "unknown",
        },
        "",
        0
      ),
      nodeScope.createScope()
    )

    if (!isFieldNode(node)) {
      throw new Error("expected field node")
    }

    expect(node.compiledSchema.value.componentType).toBe("unknown")
    expect(node.compiledSchema.value.componentProps?.placeholder).toBe("精确占位")
  })

  it("编译 group 时不持有子树", () => {
    const compiler = createTestCompiler()

    const schema = {
      label: "基本信息",
      children: [{ name: "name", label: "姓名", componentType: "input" }],
    } as SchemxField

    const node = compiler.createNode(
      compiler.compile(schema, "", 0),
      nodeScope.createScope()
    )

    expect(node.type).toBe("group")
    expect(node).not.toHaveProperty("children")
    if (!isGroupNode(node)) {
      throw new Error("expected group node")
    }

    expect(node.compiledSchema.value.children).toEqual([])
  })

  it("编译 dependency 时封装 renderer 与触发字段", () => {
    const compiler = createTestCompiler()

    const node = compiler.createNode(
      compiler.compile({ to: ["mode"], renderer: () => [] } as SchemxField, "", 0),
      nodeScope.createScope()
    )

    expect(node).toMatchObject({ type: "dependency" })
    if (!isDependencyNode(node)) {
      throw new Error("expected dependency node")
    }

    expect(node.compiledSchema.value.to).toEqual(["mode"])
  })

  it("四类 Node 只暴露当前状态，不保留弃用属性", () => {
    const compiler = createTestCompiler()

    const field = compiler.createNode(
      compiler.compile({ name: "field", label: "字段", componentType: "input" }, "", 0),
      nodeScope.createScope()
    )

    const group = compiler.createNode(
      compiler.compile({ label: "分组", children: [] }, "", 1),
      nodeScope.createScope()
    )

    const dependency = compiler.createNode(
      compiler.compile({ to: ["field"], renderer: () => [] } as SchemxField, "", 2),
      nodeScope.createScope()
    )

    const dynamic = compiler.createNode(
      compiler.compile(
        {
          key: "items",
          name: "items",
          label: "数组",
          item: [],
        } as SchemxField,
        "",
        3
      ),
      nodeScope.createScope()
    )

    if (!isFieldNode(field) || !isGroupNode(group) || !isDependencyNode(dependency)) {
      throw new Error("expected Field, Group and Dependency nodes")
    }

    if (!isDynamicNode(dynamic)) {
      throw new Error("expected Dynamic node")
    }

    expect(field.resolvedSchema).toBeDefined()
    expect(field.validationState).toBeDefined()

    // node 为四类真实工厂产物；旧属性不应继续占用运行时对象。
    for (const node of [field, group, dependency, dynamic]) {
      expect(node.compiledSchema).toBeDefined()
      expect(node.dependencyOverrides).toBeDefined()
      expect(node).not.toHaveProperty("staticSchema")
      expect(node).not.toHaveProperty("dynamicOverrides")
      expect(node).not.toHaveProperty("effectiveSchema")
      expect(node).not.toHaveProperty("effectiveState")
      expect(node).not.toHaveProperty("validationSchema")
    }
  })

  it("相同 schema 与最终节点 key 复用配置 token但创建新节点", () => {
    const compiler = createTestCompiler()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compiler.createNode(
      compiler.compile(schema, "", 0),
      nodeScope.createScope()
    )

    const second = compiler.createNode(
      compiler.compile(schema, "", 0),
      nodeScope.createScope()
    )

    expect(second).not.toBe(first)
    expect(second.configToken).toBe(first.configToken)
  })

  it("稳定 key 的字段重排后复用节点输入", () => {
    const compiler = createTestCompiler()

    const schema = {
      key: "email",
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compiler.createNode(
      compiler.compile(schema, "", 0),
      nodeScope.createScope()
    )

    const second = compiler.createNode(
      compiler.compile(schema, "", 1),
      nodeScope.createScope()
    )

    expect(second).not.toBe(first)
    expect(second.configToken).toBe(first.configToken)
  })

  it("失效缓存后生成新的配置 token", () => {
    const compiler = createTestCompiler()

    const schema = {
      name: "email",
      label: "邮箱",
      componentType: "input",
    } as SchemxField

    const first = compiler.createNode(
      compiler.compile(schema, "", 0),
      nodeScope.createScope()
    )

    compiler.invalidateConfigCache()

    const second = compiler.createNode(
      compiler.compile(schema, "", 0),
      nodeScope.createScope()
    )

    expect(second).not.toBe(first)
    expect(second.configToken).not.toBe(first.configToken)
  })

  it("Compiler 不再暴露弃用的缓存失效入口", () => {
    // 当前接口只保留 invalidateConfigCache。
    const compiler = createTestCompiler()

    expect(compiler.invalidateConfigCache).toBeTypeOf("function")
    expect(compiler).not.toHaveProperty("invalidate")
  })
})
