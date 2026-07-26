/**
 * FieldRegistry - 字段索引。
 *
 * 通过 descriptor.name 快速查询字段 entry。
 *
 * @module core/field/registry
 */

import { createFieldKey } from "../utils/path"

import type { FieldRuntimeNode } from "../node"
import type { NamePath, Values } from "../types/form"

/**
 * 字段索引条目。
 */
export interface FieldRegistryEntry<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /**
   * 字段在表单值对象中的名称路径。
   */
  readonly name: TName

  /**
   * 字段 RuntimeNode，持有字段描述符、字段运行态和字段相关资源作用域。
   *
   * @typeParam TValues - 表单值类型。
   */
  readonly node: FieldRuntimeNode<TValues>
}

/**
 * FieldRegistry 默认实现。
 */
class RuntimeFieldRegistry<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  private fields = new Map<string, FieldRegistryEntry<TValues>>()

  /**
   * 注册字段到索引。
   *
   * @param entry - 字段索引条目，包含 name 和 node。
   */
  register(entry: FieldRegistryEntry<TValues>): void {
    const key = createFieldKey(entry.name)

    this.fields.set(key, {
      name: entry.name,
      node: entry.node,
    })
  }

  /**
   * 注销字段索引。
   *
   * 传入 node 参数时做一致性校验：仅当当前条目的 node 引用相等时才执行注销，
   * 避免在字段复用过程中误释放正在使用的注册。
   *
   * @param name - 字段名称路径。
   * @param node - 可选。做 node 一致性校验，防止误释放。
   */
  unregister(name: TName, node?: FieldRuntimeNode<TValues>): void {
    const key = createFieldKey(name)

    const current = this.fields.get(key)

    if (node && current?.node !== node) {
      return
    }

    this.fields.delete(key)
  }

  /**
   * 按名称路径获取字段索引条目。
   *
   * @param name - 字段名称路径。
   * @returns 字段索引条目，未找到时返回 undefined。
   */
  get(name: TName): FieldRegistryEntry<TValues> | undefined {
    const key = createFieldKey(name)

    return this.fields.get(key)
  }

  /**
   * 按名称路径获取字段索引条目（同 get）。
   *
   * @param name - 字段名称路径。
   * @returns 字段索引条目，未找到时返回 undefined。
   */
  getByName(name: TName): FieldRegistryEntry<TValues> | undefined {
    return this.get(name)
  }

  /**
   * 按路径获取字段索引条目（同 get）。
   *
   * @param path - 字段名称路径。
   * @returns 字段索引条目，未找到时返回 undefined。
   */
  getByPath(path: TName): FieldRegistryEntry<TValues> | undefined {
    return this.get(path)
  }

  /**
   * 列出所有已注册字段。
   *
   * @returns 字段索引条目数组。
   */
  list(): FieldRegistryEntry<TValues>[] {
    return Array.from(this.fields.values())
  }
}

/**
 * FieldRegistry 的实例类型。
 */
export type FieldRegistry<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = InstanceType<typeof RuntimeFieldRegistry<TValues, TName>>

/**
 * 创建一个 FieldRegistry 实例。
 *
 * @returns 新的字段注册表。
 */
export function createFieldRegistry<
  TValues extends Values = Values,
>(): FieldRegistry<TValues> {
  return new RuntimeFieldRegistry<TValues>()
}
