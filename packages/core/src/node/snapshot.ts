/**
 * 节点更新和生命周期使用的普通数据快照；不创建响应式资源。
 */
import { isDependencyNode, isDynamicNode, isFieldNode } from "./helper"

import type { LifecycleHooks } from "../lifecycle"
import type {
  DynamicRowState,
  FieldDependencyOverrides,
  FieldRuntimeDiagnostics,
  NodeId,
  PresentationDependencyOverrides,
  SchemaNode,
} from "./types"
import type {
  NamePath,
  SchemxBaseField,
  SchemxDependencyField,
  SchemxDynamicField,
  SchemxGroupField,
  Values,
} from "../types"

/**
 * 按节点类型保留资源更新需要的旧配置。
 * @typeParam TValues - 表单值类型。
 */
export type NodeUpdateSnapshot<TValues extends Values = Values> =
  | {
      /**
       * 字段配置及改名前的路径。
       */
      readonly type: "field"
      /**
       * 字段更新前的编译配置，只读复用不可变输入。
       */
      readonly compiledSchema: Readonly<SchemxBaseField<TValues>>
      /**
       * 更新前的数据路径。
       */
      readonly name: NamePath<TValues>
    }
  | {
      /**
       * 分组的旧配置。
       */
      readonly type: "group"
      /**
       * 分组更新前的编译配置，只读复用不可变输入。
       */
      readonly compiledSchema: Readonly<SchemxGroupField<TValues>>
    }
  | {
      /**
       * 动态子树的旧配置和行位置。
       */
      readonly type: "dependency"
      /**
       * 动态依赖更新前的编译配置，只读复用不可变输入。
       */
      readonly compiledSchema: Readonly<SchemxDependencyField<TValues>>
      /**
       * 行内依赖更新前的身份和位置。
       */
      readonly dynamicRow?: DynamicRowState
    }
  | {
      /**
       * 数组模板的旧配置。
       */
      readonly type: "dynamic"
      /**
       * 动态数组更新前的编译配置，只读复用不可变输入。
       */
      readonly compiledSchema: Readonly<SchemxDynamicField<TValues>>
    }

/**
 * 各阶段都能读取的节点身份；不保留树节点或资源句柄。
 */
interface NodeSnapshotIdentity {
  /**
   * 表单内的稳定节点身份。
   */
  readonly id: NodeId
  /**
   * Schema 协调使用的稳定 key。
   */
  readonly key: string
  /**
   * 通知时的父节点身份；detached 节点为 null。
   */
  readonly parentId: NodeId | null
  /**
   * 通知时节点是否已卸载。
   */
  readonly disposed: boolean
}

/**
 * 生命周期只读快照。配置和业务对象保留不可变输入引用；元数据单独复制冻结。
 * @typeParam TValues - 表单值类型。
 */
export type NodeSnapshot<TValues extends Values = Values> = NodeSnapshotIdentity &
  (
    | (Extract<NodeUpdateSnapshot<TValues>, { type: "field" }> & {
        /**
         * 当前字段动态覆盖，不包含 Signal。
         */
        readonly dependencyOverrides: Readonly<FieldDependencyOverrides<TValues>>
        /**
         * 开启 debug 后捕获的诊断元数据。
         */
        readonly diagnostics?: Readonly<FieldRuntimeDiagnostics<TValues>>
      })
    | (Extract<
        NodeUpdateSnapshot<TValues>,
        { type: "group" | "dependency" | "dynamic" }
      > & {
        /**
         * 当前容器动态覆盖。
         */
        readonly dependencyOverrides: Readonly<PresentationDependencyOverrides>
        /**
         * 通知时的直接子节点身份。
         */
        readonly childIds: readonly NodeId[]
      } & (
          | { readonly type: "group" | "dependency" }
          | { readonly type: "dynamic"; readonly rows: readonly DynamicRowState[] }
        ))
  )

/**
 * 节点领域的生命周期通知；旧快照在更新前捕获。
 * @typeParam TValues - 表单值类型。
 */
export type NodeLifecycleHooks<TValues extends Values = Values> = LifecycleHooks<
  NodeSnapshot<TValues>
>

/**
 * 保存旧配置供领域更新比较，不读取任何派生 computed。
 * @param node - 尚未写入下一轮配置的节点。
 * @example const previous = captureNodeUpdate(node)
 */
export function captureNodeUpdate<TValues extends Values>(
  node: SchemaNode<TValues>
): NodeUpdateSnapshot<TValues> {
  if (isFieldNode(node)) {
    return {
      type: "field",
      compiledSchema: node.compiledSchema.peek(),
      name: node.name.peek(),
    }
  }

  if (isDependencyNode(node)) {
    return {
      type: "dependency",
      compiledSchema: node.compiledSchema.peek(),
      dynamicRow: node.dynamicRow,
    }
  }

  if (isDynamicNode(node)) {
    return { type: "dynamic", compiledSchema: node.compiledSchema.peek() }
  }

  return { type: "group", compiledSchema: node.compiledSchema.peek() }
}

/**
 * 捕获通知所需的只读元数据，不求值未挂载节点的有效状态。
 * @param node - 当前阶段的实际节点。
 * @example const snapshot = createNodeSnapshot(node)
 */
export function createNodeSnapshot<TValues extends Values>(
  node: SchemaNode<TValues>
): NodeSnapshot<TValues> {
  // 身份与配置只取此刻的原生状态。
  const base = {
    id: node.id,
    key: node.key,
    parentId: node.parent?.id ?? null,
    disposed: node.disposed.peek(),
    dependencyOverrides: Object.freeze({ ...node.dependencyOverrides.peek() }),
  }

  if (isFieldNode(node)) {
    // 诊断数组由 Core 拥有，复制后不会随后续通知变化。
    const diagnostics = node.diagnostics?.peek()

    return Object.freeze({
      ...base,
      type: "field",
      compiledSchema: node.compiledSchema.peek(),
      name: node.name.peek(),
      diagnostics:
        diagnostics === undefined
          ? undefined
          : Object.freeze({
              ...diagnostics,
              triggerFields: Object.freeze([...diagnostics.triggerFields]),
              overriddenKeys: Object.freeze([...diagnostics.overriddenKeys]),
            }),
    })
  }

  // 子树只保留身份列表，不把可操作的子节点带入快照。
  // child 是此阶段仍登记的直接子节点，只取稳定身份。
  const childIds = Object.freeze(node.childNodes.peek().map((child) => child.id))

  if (isDynamicNode(node)) {
    return Object.freeze({
      ...base,
      type: "dynamic",
      compiledSchema: node.compiledSchema.peek(),
      childIds,
      // row 是本阶段的行位置；复制行记录，保留业务数据的独立所有权。
      rows: Object.freeze(
        node.dynamicRows.peek().map((row) => Object.freeze({ ...row }))
      ),
    })
  }

  if (isDependencyNode(node)) {
    return Object.freeze({
      ...base,
      type: "dependency",
      compiledSchema: node.compiledSchema.peek(),
      childIds,
      dynamicRow:
        node.dynamicRow === undefined ? undefined : Object.freeze({ ...node.dynamicRow }),
    })
  }

  return Object.freeze({
    ...base,
    type: "group",
    compiledSchema: node.compiledSchema.peek(),
    childIds,
  })
}
