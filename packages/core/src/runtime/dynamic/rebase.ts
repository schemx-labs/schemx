import {
  isDependencySchema,
  isFieldSchema,
  isGroupSchema,
  normalizeNamePath,
} from "../../utils"

import type { NamePath, SchemxField, Values } from "../../types"

// Dynamic 展开阶段使用的行上下文标记，不进入普通 Schema 的枚举属性。
const DYNAMIC_CONTEXT = Symbol.for("schemx.dynamicDependencyContext")

/**
 * 同步重定位已经生成的行内字段；复用原 Schema 和节点 key，不等待 renderer 返回。
 *
 * @typeParam TValues - 表单值类型。
 * @param schemas - 当前已提交的绝对路径 Schema。
 * @param from - 当前行原来的绝对路径。
 * @param to - 同一行新的绝对路径。
 * @returns 使用新行路径的 Schema；Dependency 的全表 to 路径保持原语义。
 * @example
 * const moved = rebaseDynamicSchemas(schemas, "users.0", "users.1")
 */
export function rebaseDynamicSchemas<TValues extends Values>(
  schemas: readonly SchemxField<TValues>[],
  from: string,
  to: string
): SchemxField<TValues>[] {
  /**
   * 只替换当前行前缀，其他全表路径不参与重定位。
   * @param name - 要关联的字段或依赖路径。
   */
  const rebaseName = (name: NamePath<TValues>): NamePath<TValues> => {
    const path = normalizeNamePath(name)

    return path === from || path.startsWith(`${from}.`)
      ? (`${to}${path.slice(from.length)}` as NamePath<TValues>)
      : name
  }

  return schemas.map((schema) => {
    if (isDependencySchema(schema)) {
      const contextKey = Reflect.get(schema, DYNAMIC_CONTEXT)

      if (typeof contextKey !== "string") return schema

      const next = { ...schema }

      Object.defineProperty(next, DYNAMIC_CONTEXT, {
        configurable: true,
        enumerable: false,
        value: `${contextKey.slice(0, contextKey.indexOf(":"))}:${to}`,
      })

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
