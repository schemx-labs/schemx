/**
 * 领域资源注册表（RuntimeNode 之外的事实存储）。
 *
 * 资源表通过 `RuntimeNodeId` 关联，不承载领域逻辑。
 * 创建逻辑留在各领域模块中，调用方在明确边界内直接读写对应 Map。
 *
 * @module core/runtime/node/resources
 */

import { createFieldKey } from "../../utils/path"

import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  RuntimeDependencyIndex,
  RuntimeFieldIndex,
  RuntimeNodeId,
  RuntimeNodeResourceContext,
} from "./types"
import type { NamePath, Values } from "../../types"

/**
 * 创建 RuntimeNode 之外的领域资源注册表。
 *
 * 资源通过 `RuntimeNodeId` 关联，资源表是事实存储，不承载领域逻辑。
 * 创建逻辑仍留在各领域模块中，调用方在明确边界内直接读写对应 Map。
 *
 * @typeParam TValues - 表单值类型
 * @returns 资源注册表实例，包含 nodes Map、fieldIndex 和 dependencyIndex
 */
export function createRuntimeResources<
  TValues extends Values = Values,
>(): RuntimeNodeResourceContext<TValues> {
  return {
    nodes: new Map(),
    fieldIndex: createRuntimeFieldIndex(),
    dependencyIndex: createRuntimeDependencyIndex(),
  }
}

/**
 * 删除某个节点在所有资源表中的记录。
 *
 * 一致性清理 helper：避免调用方在移除节点时遗漏某张资源表。
 * 不负责领域资源自身的 dispose，那由各领域 scope 在卸载时处理。
 *
 * @typeParam TValues - 表单值类型
 * @param resources - 资源注册表
 * @param nodeId - 要移除的节点 ID
 */
export function deleteNodeResources<TValues extends Values>(
  resources: RuntimeNodeResourceContext<TValues>,
  nodeId: RuntimeNodeId
): void {
  resources.nodes.delete(nodeId)
}

/**
 * 创建字段索引：维护字段名到字段节点的映射。
 *
 * 内部使用 `Map<NamePath, FieldRuntimeNode>`，提供注册、注销和按名查找能力。
 *
 * @typeParam TValues - 表单值类型
 * @returns 字段索引实例
 */
function createRuntimeFieldIndex<TValues extends Values>(): RuntimeFieldIndex<TValues> {
  const nodesByName = new Map<string, FieldRuntimeNode<TValues>>()

  /**
   * 从索引中移除指定字段节点。
   *
   * 先按 descriptor.name 精准删除；再用全量遍历兜底，防止因 descriptor 状态异常导致的残留。
   */
  const unregister = (node: FieldRuntimeNode<TValues>): void => {
    const descriptor = node.descriptor

    if (descriptor?.type === "field") {
      const current = nodesByName.get(createFieldKey(descriptor.name))

      if (current === node) {
        nodesByName.delete(createFieldKey(descriptor.name))
      }
    }

    for (const [name, current] of nodesByName) {
      if (current === node) {
        nodesByName.delete(name)
      }
    }
  }

  return {
    register(node) {
      const descriptor = node.descriptor

      if (descriptor?.type !== "field") {
        return
      }

      nodesByName.set(createFieldKey(descriptor.name), node)
    },
    unregister,
    getByName(name) {
      return nodesByName.get(createFieldKey(name))
    },
    getByPath(path) {
      return nodesByName.get(createFieldKey(path))
    },
  }
}

/**
 * 创建 dependency 索引：维护触发字段与 dependency 节点的双向映射。
 *
 * 提供两个方向的查询能力：
 * - 按触发字段名查找所有关联的 dependency 节点；
 * - 按 dependency 节点查找其所有触发字段。
 *
 * @typeParam TValues - 表单值类型
 * @returns dependency 索引实例
 */
function createRuntimeDependencyIndex<
  TValues extends Values,
>(): RuntimeDependencyIndex<TValues> {
  const triggerFieldsByNode = new Map<
    DependencyRuntimeNode<TValues>,
    readonly NamePath<TValues>[]
  >()

  const nodesByTriggerField = new Map<string, DependencyRuntimeNode<TValues>[]>()

  /**
   * 从索引中移除指定 dependency 节点，并清理所有关联的反向索引。
   */
  const unregister = (node: DependencyRuntimeNode<TValues>): void => {
    const triggerFields = triggerFieldsByNode.get(node) ?? []

    for (const triggerField of triggerFields) {
      const key = createFieldKey(triggerField)

      const nodes = nodesByTriggerField.get(key)

      if (!nodes) {
        continue
      }

      const nextNodes = nodes.filter((current) => current !== node)

      if (nextNodes.length > 0) {
        nodesByTriggerField.set(key, nextNodes)
      } else {
        nodesByTriggerField.delete(key)
      }
    }

    triggerFieldsByNode.delete(node)
  }

  return {
    /**
     * 注册 dependency 节点。
     *
     * 先注销旧索引再重新注册，确保节点触发字段变更后索引保持最新。
     */
    register(node) {
      const descriptor = node.descriptor

      if (descriptor?.type !== "dependency") {
        return
      }

      // 先移除旧索引，确保触发字段变更后数据一致
      unregister(node)
      triggerFieldsByNode.set(node, descriptor.triggerFields)

      for (const triggerField of descriptor.triggerFields) {
        const key = createFieldKey(triggerField)

        const nodes = nodesByTriggerField.get(key) ?? []

        if (!nodes.includes(node)) {
          nodesByTriggerField.set(key, [...nodes, node])
        }
      }
    },
    unregister,
    getByTriggerField(name) {
      return nodesByTriggerField.get(createFieldKey(name)) ?? []
    },
    getTriggerFields(node) {
      return triggerFieldsByNode.get(node) ?? []
    },
  }
}
