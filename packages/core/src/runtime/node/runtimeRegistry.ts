/**
 * Runtime 跨节点查询注册表。
 *
 * 资源表通过 `RuntimeNodeId` 关联，不承载领域逻辑。
 * 创建逻辑留在各领域模块中，调用方在明确边界内直接读写对应 Map。
 *
 * @module core/runtime/node/runtimeRegistry
 */

import { createFieldKey } from "../../utils/path"

import type { FieldRuntimeNode, RuntimeFieldIndex, RuntimeRegistry } from "./types"
import type { NamePath, Values } from "../../types"

/**
 * 创建 Runtime 跨节点查询注册表。
 *
 * 节点自身持有状态、View 和 Effect；注册表只提供字段名查询。
 *
 * @typeParam TValues - 表单值类型
 * @returns 包含节点表与字段索引的注册表。
 */
export function createRuntimeRegistry<
  TValues extends Values = Values,
>(): RuntimeRegistry<TValues> {
  return {
    fieldIndex: createRuntimeFieldIndex(),
  }
}

/**
 * 创建字段索引：维护字段名到字段节点的映射。
 *
 * 内部使用字段路径键，并确保注销不会移除同名的新节点。
 *
 * @typeParam TValues - 表单值类型
 * @returns 字段索引实例
 */
function createRuntimeFieldIndex<TValues extends Values>(): RuntimeFieldIndex<TValues> {
  const nodesByName = new Map<string, FieldRuntimeNode<TValues>>()

  const unregister = (node: FieldRuntimeNode<TValues>, name: NamePath<TValues>): void => {
    const key = createFieldKey(name)

    if (nodesByName.get(key) === node) {
      nodesByName.delete(key)
    }
  }

  return {
    register(node) {
      nodesByName.set(createFieldKey(node.name), node)
    },
    unregister,
    get(name) {
      return nodesByName.get(createFieldKey(name))
    },
  }
}
