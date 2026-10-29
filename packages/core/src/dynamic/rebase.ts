import { isDependencySchema, isFieldSchema, isGroupSchema } from "../utils"

import { rebaseDynamicPath } from "./paths"
import { attachDynamicRow, getDynamicRow } from "./rowContext"

import type { DynamicRowState } from "../node/types"
import type { NamePath, SchemxField, Values } from "../types"

/**
 * 同步重定位已经生成的行内字段；复用原 Schema 和节点 key，不等待 renderer 返回。
 *
 * @typeParam TValues - 表单值类型。
 * @param schemas - 当前已提交的绝对路径 Schema。
 * @param from - 当前行原来的身份和位置快照。
 * @param to - 同一行新的位置快照。
 * @returns 使用新行路径的 Schema；Dependency 的全表 to 路径保持原语义。
 * @example
 * const moved = rebaseDynamicSchemas(schemas, previousRow, currentRow)
 */
export function rebaseDynamicSchemas<TValues extends Values>(
  schemas: readonly SchemxField<TValues>[],
  from: DynamicRowState,
  to: DynamicRowState
): SchemxField<TValues>[] {
  /**
   * 只替换当前行前缀，其他全表路径不参与重定位。
   * @param name - 要关联的字段或依赖路径。
   */
  const rebaseName = (name: NamePath<TValues>): NamePath<TValues> => {
    // 输入来自已验证的 Schema，只替换行前缀，不改变其余路径段的意义。
    return rebaseDynamicPath(name, from.path, to.path) as NamePath<TValues>
  }

  // schema 为当前已生成的字段、容器或行内 Dependency。
  return schemas.map((schema) => {
    if (isDependencySchema(schema)) {
      // 只有行模板生成的 Dependency 才携带内部行关联。
      const row = getDynamicRow(schema)

      if (!row) {
        return schema
      }

      // 新对象持有新行快照，旧编译配置和生命周期快照继续保留旧位置。
      const next = { ...schema }

      attachDynamicRow(next, to)

      return next
    }

    if (isGroupSchema(schema)) {
      return {
        ...schema,
        children: rebaseDynamicSchemas(schema.children, from, to),
        dependencies: schema.dependencies && {
          ...schema.dependencies,
          triggerFields: schema.dependencies.triggerFields.map(rebaseName),
        },
      }
    }

    if (isFieldSchema(schema)) {
      // 合并到新对象，保留 componentType 与 componentProps 的联合类型关联。
      return Object.assign({}, schema, {
        name: rebaseName(schema.name),
        dependencies: schema.dependencies && {
          ...schema.dependencies,
          triggerFields: schema.dependencies.triggerFields.map(rebaseName),
        },
      })
    }

    return schema
  })
}
