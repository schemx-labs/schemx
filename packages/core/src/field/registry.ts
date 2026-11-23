/**
 * FieldRegistry - 字段索引。
 *
 * 通过 descriptor.schema.name 快速查询字段 entry。Registry 不依赖
 * FieldModel.name，因为 FieldModel 不持有静态字段身份。
 *
 * @module core/field/registry
 */

import type { FieldModel } from "./model"
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
   * 字段 RuntimeNode，持有字段描述符、字段模型和字段相关资源作用域。
   *
   * @typeParam TValues - 表单值类型。
   */
  readonly node: FieldRuntimeNode<TValues>

  /**
   * 字段运行时模型；卸载字段主体资源后会被清空或重建。
   */
  readonly model: FieldModel<TValues>
}

/**
 * FieldRegistry 默认实现。
 */
class RuntimeFieldRegistry<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  private fields = new Map<string, FieldRegistryEntry<TValues>>()

  register(entry: FieldRegistryEntry<TValues>): void {
    const key = entry.name
    this.fields.set(key, entry)
  }

  unregister(name: TName, node?: FieldRuntimeNode<TValues>): void {
    const key = name
    const current = this.fields.get(key)

    if (node && current?.node !== node) {
      return
    }

    this.fields.delete(key)
  }

  get(name: TName): FieldRegistryEntry<TValues> | undefined {
    const key = name

    return this.fields.get(key)
  }

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
