import { describe, expect, it } from "vite-plus/test"

import { createSchemaCompiler } from "../../compiler/createSchemaCompiler"
import { createFormConfig } from "../../config/createFormConfig"
import { createStore } from "../../store/store"
import { isDependencySchema, isGroupSchema } from "../../utils/schema"
import { createDynamicSchemaExpander } from "../expandSchemas"
import { joinDynamicPath, rebaseDynamicPath } from "../paths"
import { rebaseDynamicSchemas } from "../rebase"
import { getDynamicRow } from "../rowContext"

import type { DynamicRowState } from "../../node/types"
import type { SchemxDynamicField } from "../../types"

describe("Dynamic 行上下文与路径协议", () => {
  it("通过行快照传递上下文，复用包装器并保留旧编译结果的位置", () => {
    // 展开器只读取 Store，不保存另一份行值。
    const store = createStore()

    // 当前数组订阅独占展开器和 renderer 缓存。
    const expander = createDynamicSchemaExpander(store)

    // 真实 Compiler 验证元数据能够进入纯编译配置。
    const compiler = createSchemaCompiler({
      config: createFormConfig().getConfig(),
    })

    // Field/Group 的依赖使用相对路径，Dependency 的依赖使用全表路径。
    const schema: SchemxDynamicField = {
      key: "users",
      name: "users",
      item: [
        {
          key: "group",
          label: "分组",
          dependencies: { triggerFields: ["name"] },
          children: [
            {
              key: "dependent",
              to: ["mode"],
              dependencies: { triggerFields: ["mode"] },
              renderer: () => [],
            },
          ],
        },
      ],
    }

    // Store key 和 Runtime 身份在行移动后保持有效。
    const row: DynamicRowState = { id: 7, key: "row", index: 0, path: "users.0" }

    try {
      // 第一轮展开后的 Group。
      const group = expander.expand(schema, [row])[0]

      if (!group || !isGroupSchema(group)) {
        throw new Error("分组未展开")
      }

      // 已关联行上下文、但未添加内部属性的 Dependency。
      const dependency = group.children[0]

      if (!dependency || !isDependencySchema(dependency)) {
        throw new Error("Dependency 未展开")
      }

      // 编译配置保留当前行的不可变位置快照。
      const config = compiler.compile(dependency, group.key ?? "", 0)

      expect(group.dependencies?.triggerFields).toEqual(["users.0.name"])
      expect(dependency.to).toEqual(["mode"])
      expect(dependency.dependencies?.triggerFields).toEqual(["mode"])
      expect(getDynamicRow(dependency)).toBe(row)
      expect(config.dynamicRow).toBe(row)
      expect(Object.getOwnPropertySymbols(dependency)).toEqual([])
      expect(dependency).not.toHaveProperty("dynamicRow")
      expect(config.schema).not.toHaveProperty("dynamicRow")

      // 同一行的新位置采用新快照，不会改写上一轮的编译结果。
      const movedRow = { ...row, index: 1, path: "users.1" }

      // 重排后仍复用相同的 renderer 包装器。
      const movedGroup = expander.expand(schema, [movedRow])[0]

      if (!movedGroup || !isGroupSchema(movedGroup)) {
        throw new Error("移动后的分组未展开")
      }

      // 新一轮生成的 Dependency 携带新位置，普通 Schema 属性仍保持原语义。
      const movedDependency = movedGroup.children[0]

      if (!movedDependency || !isDependencySchema(movedDependency)) {
        throw new Error("移动后的 Dependency 未展开")
      }

      expect(movedDependency.renderer).toBe(dependency.renderer)
      expect(getDynamicRow(movedDependency)).toBe(movedRow)
      expect(config.dynamicRow?.path).toBe("users.0")

      // 已生成子树的重定位通过同一行快照协议传递给嵌套 Dependency。
      const [rebased] = rebaseDynamicSchemas([dependency], row, movedRow)

      expect(rebased && getDynamicRow(rebased)).toBe(movedRow)
      expect(rebased && isDependencySchema(rebased) && rebased.to).toEqual(["mode"])
    } finally {
      expander.dispose()
      store.destroy()
    }
  })

  it.each([
    ['users[0]["display.name"]', "users.0", "members.2", 'members.2["display.name"]'],
    ['users.0["a[b]"]', "users.0", "users.1", 'users.1["a[b]"]'],
    ['users.0[""]', "users.0", "users.1", 'users.1[""]'],
    ["users.10.name", "users.1", "users.2", "users.10.name"],
    [
      '["user.list"].0.name',
      '["user.list"].0',
      '["user.list"].1',
      '["user.list"].1.name',
    ],
  ])("重定位 %s 时保留路径段边界", (path, from, to, expected) => {
    // path、from、to 是输入路径和新旧行前缀，expected 是应保留的实际字段地址。
    expect(rebaseDynamicPath(path, from, to)).toBe(expected)
  })

  it("拼接行路径时保留方括号和数组索引语法", () => {
    expect(joinDynamicPath("users.0", '["display.name"]')).toBe('users.0["display.name"]')
    expect(joinDynamicPath("users.0", "profile[0].name")).toBe("users.0.profile[0].name")
    expect(joinDynamicPath("users.0", "")).toBe("users.0")
  })
})
