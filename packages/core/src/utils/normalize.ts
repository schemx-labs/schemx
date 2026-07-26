/**
 * Schema 标准化工具。
 *
 * 在编译边界校验 Schema 的运行时结构，并在缺失 field `componentType` 时补入
 * 显式默认渲染器类型。
 *
 * @module utils/normalize
 */

import { CompileError } from "../runtime/compiler/types"

import { getSchemaKind } from "./schema"

import type { SchemxField, SchemxRendererKey, Values } from "../types"

/**
 * 标准化 schema 配置。
 *
 * 合法且无需补值的 schema 会保留原引用；只有 field 使用默认组件类型或 group
 * 子节点变化时才会创建新对象。旧版 Group 与 Dependency 容器会被过滤并告警。
 *
 * @typeParam T - 表单值类型。
 * @param schemas - 待校验的 schema 数组。
 * @param defaultRendererType - 缺失 field `componentType` 时使用的显式默认类型。
 * @returns 通过校验后的 schema 数组。
 * @throws CompileError - schemas 或其节点不满足运行时结构约束时抛出。
 *
 * @example
 * ```ts
 * normalizeSchemas([{ name: "email", label: "" }], "input")
 * ```
 */
export function normalizeSchemas<T extends Values = Values>(
  schemas: unknown,
  defaultRendererType?: SchemxRendererKey
): SchemxField<T>[] {
  const normalize = (items: unknown, path: string): SchemxField<T>[] => {
    if (!Array.isArray(items)) {
      throw new CompileError(`[schemx] ${path} 必须是数组`)
    }

    const result: SchemxField<T>[] = []

    let changed = false

    for (let index = 0; index < items.length; index++) {
      const itemPath = `${path}[${index}]`

      const item = items[index]

      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new CompileError(`[schemx] ${itemPath} 必须是对象`)
      }

      const schema = item as Record<string, unknown>

      const kind = getSchemaKind(schema as unknown as SchemxField<T>)

      if (kind === "group" && schema.componentType === "group") {
        console.warn(
          '[schemx] Group Schema 不再接受 componentType: "group"；请删除 componentType，并通过 children 声明 Group。'
        )
        changed = true
        continue
      }

      if (kind === "dependency" && schema.componentType === "dependency") {
        console.warn(
          '[schemx] Dependency Schema 不再接受 componentType: "dependency"；请删除 componentType，并通过 to 与 renderer 声明 Dependency。'
        )
        changed = true
        continue
      }

      let normalized = item as SchemxField<T>

      if (kind === "field") {
        if (typeof schema.name !== "string" || schema.name.length === 0) {
          throw new CompileError(`[schemx] ${itemPath}.name 必须是非空字符串`)
        }

        if (typeof schema.label !== "string") {
          throw new CompileError(`[schemx] ${itemPath}.label 必须是字符串`)
        }

        if (schema.componentType === undefined) {
          if (
            typeof defaultRendererType !== "string" ||
            defaultRendererType.length === 0
          ) {
            throw new CompileError(`[schemx] ${itemPath}.componentType 必须是非空字符串`)
          }

          normalized = { ...schema, componentType: defaultRendererType } as SchemxField<T>
        } else if (
          typeof schema.componentType !== "string" ||
          schema.componentType.length === 0
        ) {
          throw new CompileError(`[schemx] ${itemPath}.componentType 必须是非空字符串`)
        }
      } else if (kind === "group") {
        if (typeof schema.label !== "string") {
          throw new CompileError(`[schemx] ${itemPath}.label 必须是字符串`)
        }

        if (!Array.isArray(schema.children)) {
          throw new CompileError(`[schemx] ${itemPath}.children 必须是数组`, schema)
        }

        const children = normalize(schema.children, `${itemPath}.children`)

        if (children !== schema.children) {
          normalized = { ...schema, children } as SchemxField<T>
        }
      } else {
        if (
          !Array.isArray(schema.to) ||
          schema.to.length === 0 ||
          !schema.to.every((name) => typeof name === "string" && name.length > 0)
        ) {
          throw new CompileError(
            `[schemx] ${itemPath}.to 必须是包含非空字符串的数组`,
            schema
          )
        }

        if (typeof schema.renderer !== "function") {
          throw new CompileError(`[schemx] ${itemPath}.renderer 必须是函数`, schema)
        }
      }

      result.push(normalized)
      changed ||= normalized !== item
    }

    return changed ? result : (items as SchemxField<T>[])
  }

  return normalize(schemas, "schemas")
}
