/**
 * Node ViewSchema 生命周期与 computed ViewSchema 图。
 *
 * ViewSchema computed 挂在 runtime node 上，维护增删改查所需的投影图；
 * 读取 root viewSchemas 时直接取 root computed 的当前值。
 *
 * @module core/runtime/view/createViewSchemas
 */

import { createComputed } from "../../reactivity/computed"
import { isDependencyNode, isDynamicNode, isFieldNode, isGroupNode } from "../node/helper"

import type { ContainerNode, RootNode, SchemaNode } from "../node"
import type {
  SchemxViewDynamicSchema,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
import type { Values } from "../../types"

/**
 * 为 root 创建并注册 ViewSchema computed。
 *
 * root 的 viewSchemas 是一个 computed，读取 childNodes 后递归收集
 * 所有子节点的 view schema，形成扁平化的顶层 schema 数组。
 *
 * @param root - root runtime 节点。
 */
export function createRootRuntimeViewSchemas<TValues extends Values = Values>(
  root: RootNode<TValues>
): void {
  root.viewSchemas = createComputed(() => readChildrenViewSchemas(root.childNodes.value))
}

/**
 * 为 Node 创建并注册对应 ViewSchema computed。
 *
 * 根据节点类型（field / group / dependency / dynamic）分别构建对应的 view computed。
 *
 * @param node - 待创建视图状态的运行时节点。
 * @param debug - 是否在 ViewSchema 中附加调试元数据。
 * @throws 当传入不支持的 schema Node 类型时抛出错误。
 */
export function createRuntimeViewSchemas<TValues extends Values = Values>(
  node: SchemaNode<TValues>,
  debug = false
): void {
  if (isFieldNode(node)) {
    // 字段 View 直接由静态 schema 与有效字段状态投影，避免在 Field 状态中重复维护 ViewSchema。
    node.viewSchemas = createComputed(() => {
      const staticSchema = node.staticSchema.value

      const effectiveSchema = node.effectiveSchema.value

      const diagnostics = node.diagnostics?.value

      const { dependencies: _dependencies, ...viewStaticSchema } = staticSchema

      return [
        {
          ...viewStaticSchema,
          ...effectiveSchema,
          ...(debug
            ? {
                debug: {
                  runtimeNodeId: node.id,
                  runtimeNodeType: "field",
                  hasRuntimeState: true,
                  hasDependencyEffect: staticSchema.dependencies != null,
                  ...(diagnostics
                    ? {
                        lastUpdatedBy: diagnostics.lastUpdatedBy,
                        overriddenKeys: diagnostics.overriddenKeys,
                        error: diagnostics.error?.message ?? null,
                      }
                    : {}),
                },
              }
            : {}),
        } satisfies SchemxViewFieldSchema<TValues>,
      ]
    })

    return
  }

  if (isGroupNode(node)) {
    // 分组 view 合并容器有效状态，并递归读取子节点 viewSchemas。
    node.viewSchemas = createComputed(() => {
      const effective = node.effectiveState.value

      const staticSchema = node.staticSchema.value

      const { dependencies: _dependencies, ...viewStaticSchema } = staticSchema

      return [
        {
          ...viewStaticSchema,
          key: node.key,
          visible: effective.visible,
          readonly: effective.readonly,
          disabled: effective.disabled,
          children: readChildrenViewSchemas(node.childNodes.value),
          ...(debug
            ? {
                debug: {
                  runtimeNodeId: node.id,
                  runtimeNodeType: "group",
                  hasRuntimeState: true,
                  hasDependencyEffect: staticSchema.dependencies != null,
                },
              }
            : {}),
        } satisfies SchemxViewGroupSchema<TValues>,
      ]
    })

    return
  }

  if (isDynamicNode(node)) {
    // Dynamic 节点保留数组行边界，模板字段通过稳定行 key 分组投影。
    node.viewSchemas = createComputed(() => {
      const staticSchema = node.staticSchema.value

      const effective = node.effectiveState.value

      const {
        dependencies: _dependencies,
        item: _item,
        ...viewStaticSchema
      } = staticSchema

      const childNodes = node.childNodes.value

      const childrenByRowKey = new Map<string, SchemaNode<TValues>[]>()

      const childKeyPrefix = `${node.key}/`

      for (const child of childNodes) {
        if (!child.key.startsWith(childKeyPrefix)) {
          continue
        }

        const rowKeyStart = childKeyPrefix.length

        const rowKeyEnd = child.key.indexOf("/", rowKeyStart)

        if (rowKeyEnd < 0) {
          continue
        }

        const rowKey = child.key.slice(rowKeyStart, rowKeyEnd)

        const rowChildren = childrenByRowKey.get(rowKey)

        if (rowChildren) {
          rowChildren.push(child)
        } else {
          childrenByRowKey.set(rowKey, [child])
        }
      }

      return [
        {
          ...viewStaticSchema,
          key: node.key,
          visible: effective.visible,
          readonly: effective.readonly,
          disabled: effective.disabled,
          items: node.dynamicRows.value.map((row) => {
            const rowChildren = childrenByRowKey.get(row.key) ?? []

            return {
              key: row.key,
              index: row.index,
              children: readChildrenViewSchemas(rowChildren),
            }
          }),
          ...(debug
            ? {
                debug: {
                  runtimeNodeId: node.id,
                  runtimeNodeType: "dynamic",
                  hasRuntimeState: true,
                  hasDependencyEffect: staticSchema.dependencies != null,
                },
              }
            : {}),
        } satisfies SchemxViewDynamicSchema<TValues>,
      ]
    })

    return
  }

  if (isDependencyNode(node)) {
    // dependency 节点本身不产生 ViewSchema，直接透明展开子节点的 schema 数组。
    node.viewSchemas = createComputed(() =>
      readChildrenViewSchemas(node.childNodes.value)
    )

    return
  }

  throw new Error("[schemx] Unsupported schema runtime node.")
}

/**
 * 清理 Node 对应 ViewSchema computed。
 *
 * 将节点的 viewSchemas 置为 null，使节点不再参与父级投影。
 *
 * @param node - 要删除视图状态的运行时节点。
 */
export function clearRuntimeViewSchemas<TValues extends Values = Values>(
  node: ContainerNode<TValues>
): void {
  node.viewSchemas = null
}

/**
 * 递归读取子节点的 ViewSchema，拼接为扁平的 ViewSchema 数组。
 *
 * 跳过没有 viewSchemas 的节点；dependency 节点已经在自身 computed 中完成透明展开。
 *
 * @param children - 子运行时节点列表。
 * @returns 扁平化的 ViewSchema 数组。
 */
function readChildrenViewSchemas<TValues extends Values>(
  children: readonly SchemaNode<TValues>[]
): readonly SchemxViewSchema<TValues>[] {
  const result: SchemxViewSchema<TValues>[] = []

  for (const child of children) {
    // 节点资源尚未挂载或已卸载时，不参与父级 ViewSchema 投影。
    if (!child.viewSchemas) {
      continue
    }

    result.push(...child.viewSchemas.value)
  }

  return result
}
