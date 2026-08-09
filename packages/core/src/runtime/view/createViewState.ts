/**
 * RuntimeNode ViewState 生命周期与 computed ViewSchema 图。
 *
 * ViewState 挂在 runtime node 上，增删改查维护 computed 图节点；
 * 读取 root viewSchemas 时直接取 root computed 的当前值。
 *
 * @module core/runtime/view/createViewState
 */

import { createComputed } from "../../reactivity/computed"
import {
  isDependencyRuntimeNode,
  isFieldRuntimeNode,
  isGroupRuntimeNode,
} from "../node/helper"

import type { RootRuntimeNode, RuntimeNode, SchemaRuntimeNode } from "../node"
import type {
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
import type { ComputedSignal } from "../../reactivity/computed"
import type { Values } from "../../types"

/**
 * 字段节点视图状态。
 */
export interface FieldNodeViewState<TValues extends Values = Values> {
  /**
   * 字段 ViewSchema computed
   */
  readonly view: ComputedSignal<SchemxViewFieldSchema<TValues> | null>
}

/**
 * 分组节点视图状态。
 */
export interface GroupViewState<TValues extends Values = Values> {
  /**
   * 分组 ViewSchema computed
   */
  readonly view: ComputedSignal<SchemxViewGroupSchema<TValues> | null>
}

/**
 * Dependency 节点视图状态。
 *
 * dependency 节点本身不产生 ViewSchema，其 children 的 ViewSchema 会被
 * 透明展开到父级。因此这里的 view 是数组而非单个 schema。
 */
export interface DependencyViewState<TValues extends Values = Values> {
  /**
   * dependency 透明展开的 children ViewSchemas computed
   */
  readonly view: ComputedSignal<readonly SchemxViewSchema<TValues>[]>
}

/**
 * Root 节点视图状态。
 */
export interface RootViewState<TValues extends Values = Values> {
  /**
   * 顶层 ViewSchemas computed
   */
  readonly viewSchemas: ComputedSignal<readonly SchemxViewSchema<TValues>[]>
}

/**
 * 运行时节点视图状态的联合类型。
 *
 * 每种节点类型拥有不同的视图状态结构：
 * - root 持有 viewSchemas（数组）
 * - field 持有 view（单个字段 schema 或 null）
 * - group 持有 view（单个分组 schema 或 null）
 * - dependency 持有 view（children schema 数组）
 */
export type RuntimeViewState<TValues extends Values = Values> =
  | FieldNodeViewState<TValues>
  | GroupViewState<TValues>
  | DependencyViewState<TValues>
  | RootViewState<TValues>

/**
 * 为 root 创建并注册 ViewState。
 *
 * root 的 viewSchemas 是一个 computed，读取 childNodes 后递归收集
 * 所有子节点的 view schema，形成扁平化的顶层 schema 数组。
 *
 * @param root - root runtime 节点。
 * @param _resources - 运行时资源上下文（当前未使用）。
 * @returns root 视图状态。
 */
export function createRootRuntimeViewState<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues>
): RootViewState<TValues> {
  const viewState: RootViewState<TValues> = {
    viewSchemas: createComputed(() => readChildrenViewSchemas(root.childNodes.value)),
  }

  root.viewState = viewState

  return viewState
}

/**
 * 为 RuntimeNode 创建并注册对应 ViewState。
 *
 * 根据节点类型（field / group / dependency）分别构建对应的 view computed。
 *
 * @param node - 待创建视图状态的运行时节点。
 * @param debug - 是否在 ViewSchema 中附加调试元数据。
 * @returns 创建的运行时视图状态。
 * @throws 当 field 节点缺少 fieldState 时抛出错误。
 */
export function createRuntimeViewState<TValues extends Values = Values>(
  node: SchemaRuntimeNode<TValues>,
  debug = false
): RuntimeViewState<TValues> {
  if (isFieldRuntimeNode(node)) {
    const runtimeState = node.fieldState

    if (!runtimeState) {
      throw new Error(`[schemx] fieldState is required for node "${node.key}"`)
    }

    // 字段 View 直接由静态 schema 与有效字段状态投影，避免在 Field 状态中重复维护 ViewSchema。
    const viewState: FieldNodeViewState<TValues> = {
      view: createComputed(() => {
        const staticSchema = runtimeState.staticSchema.value

        const effectiveSchema = runtimeState.effectiveSchema.value

        const diagnostics = runtimeState.diagnostics?.value

        return {
          ...staticSchema,
          ...effectiveSchema,
          key: node.key,
          placeholder: effectiveSchema.placeholder,
          componentProps: effectiveSchema.componentProps,
          ...(diagnostics ? { debug: {
            runtimeNodeId: node.id,
            runtimeNodeType: "field",
            hasRuntimeState: true,
            hasDependencyEffect: false,
            lastUpdatedBy: diagnostics.lastUpdatedBy,
            overriddenKeys: diagnostics.overriddenKeys,
            error: diagnostics.error?.message ?? null,
          } } : {}),
        } as unknown as SchemxViewFieldSchema<TValues>
      }),
    }

    node.viewState = viewState

    return viewState
  }

  if (isGroupRuntimeNode(node)) {
    const runtimeState = node.presentationState

    if (!runtimeState) {
      throw new Error(
        `[schemx] presentationState is required for group node "${node.key}"`
      )
    }

    // 分组 view 合并容器有效状态，并递归读取子节点 viewSchemas。
    const viewState: GroupViewState<TValues> = {
      view: createComputed(() => {
        const effective = runtimeState.effectiveState.value

        return {
          ...node.staticSchema,
          key: node.key,
          visible: effective.visible,
          readonly: effective.readonly,
          disabled: effective.disabled,
          children: readChildrenViewSchemas(node.childNodes.value),
          ...(debug ? { debug: {
            runtimeNodeId: node.id,
            runtimeNodeType: "group",
            hasRuntimeState: true,
            hasDependencyEffect: node.dynamicProps != null,
          } } : {}),
        } as SchemxViewGroupSchema<TValues>
      }),
    }

    node.viewState = viewState

    return viewState
  }

  if (isDependencyRuntimeNode(node)) {
    // dependency 节点本身不产生 ViewSchema，其 view 直接返回子节点的 schema 数组
    const viewState: DependencyViewState<TValues> = {
      view: createComputed(() => readChildrenViewSchemas(node.childNodes.value)),
    }

    node.viewState = viewState

    return viewState
  }

  throw new Error("[schemx] Unsupported schema runtime node.")
}

/**
 * 删除 RuntimeNode 对应 ViewState。
 *
 * 将节点的 viewState 置为 null，断开 computed 引用。
 *
 * @param node - 要删除视图状态的运行时节点。
 * @param _resources - 运行时资源上下文。
 */
export function deleteRuntimeViewState<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): void {
  node.viewState = null
}

/**
 * 递归读取子节点的 ViewSchema，拼接为扁平的 ViewSchema 数组。
 *
 * 跳过已销毁的节点和无 view 状态的节点。
 * dependency 节点的 view 是数组（透明展开），会被展开后合并到结果中。
 *
 * @param children - 子运行时节点列表。
 * @returns 扁平化的 ViewSchema 数组。
 */
function readChildrenViewSchemas<TValues extends Values>(
  children: readonly SchemaRuntimeNode<TValues>[]
): readonly SchemxViewSchema<TValues>[] {
  const result: SchemxViewSchema<TValues>[] = []

  for (const child of children) {
    // 跳过已销毁或没有 view 状态的节点
    if (child.disposed.value || !child.viewState || !("view" in child.viewState)) {
      continue
    }

    const view = child.viewState.view.value

    // dependency 节点的 view 是数组（透明展开），group/field 是单个 schema 或 null
    if (Array.isArray(view)) {
      result.push(...(view as readonly SchemxViewSchema<TValues>[]))
    } else if (view) {
      result.push(view as SchemxViewSchema<TValues>)
    }
  }

  return result
}
