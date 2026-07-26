/**
 * RuntimeNode ViewState 生命周期与 computed ViewSchema 图。
 *
 * ViewState 挂在 runtime node 上，增删改查维护 computed 图节点；
 * 读取 root viewSchemas 时直接取 root computed 的当前值。
 *
 * @module core/view/createViewState
 */

import {
  type FormDescriptor,
  isDependencyDescriptor,
  isFieldDescriptor,
  isGroupDescriptor,
} from "../descriptor"
import {
  isDependencyRuntimeNode,
  isFieldRuntimeNode,
  isGroupRuntimeNode,
} from "../node/helper"
import { createComputed } from "../reactivity/computed"

import type {
  DescribedRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeResourceContext,
} from "../node"
import type {
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
import type { ComputedSignal } from "../reactivity/computed"
import type { SchemxComponentProps, Values } from "../types"

/**
 * 字段节点视图状态。
 */
export interface FieldNodeViewState<TValues extends Values = Values> {
  /** 字段 ViewSchema computed */
  readonly view: ComputedSignal<SchemxViewFieldSchema<TValues> | null>
}

/**
 * 分组节点视图状态。
 */
export interface GroupViewState<TValues extends Values = Values> {
  /** 分组 ViewSchema computed */
  readonly view: ComputedSignal<SchemxViewGroupSchema<TValues> | null>
}

/**
 * Dependency 节点视图状态。
 *
 * dependency 节点本身不产生 ViewSchema，其 children 的 ViewSchema 会被
 * 透明展开到父级。因此这里的 view 是数组而非单个 schema。
 */
export interface DependencyViewState<TValues extends Values = Values> {
  /** dependency 透明展开的 children ViewSchemas computed */
  readonly view: ComputedSignal<readonly SchemxViewSchema<TValues>[]>
}

/**
 * Root 节点视图状态。
 */
export interface RootViewState<TValues extends Values = Values> {
  /** 顶层 ViewSchemas computed */
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
  root: RootRuntimeNode<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>
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
 * 创建前会校验 descriptor 与 node 的类型是否匹配。
 *
 * @param node - 待创建视图状态的运行时节点。
 * @param descriptor - 节点对应的 descriptor。
 * @param _resources - 运行时资源上下文。
 * @returns 创建的运行时视图状态。
 * @throws 当 node 类型与 descriptor 类型不匹配时抛出错误。
 * @throws 当 field 节点缺少 fieldState 时抛出错误。
 */
export function createRuntimeViewState<TValues extends Values = Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  if (node.type !== descriptor.type) {
    throw new Error(
      `[schemx] Cannot create viewState for node "${node.key}" with descriptor "${descriptor.type}".`
    )
  }

  if (isFieldRuntimeNode(node) && isFieldDescriptor(descriptor)) {
    const runtimeState = node.fieldState

    if (!runtimeState) {
      throw new Error(`[schemx] fieldState is required for node "${node.key}"`)
    }

    // 字段 view 是 computed：从 fieldState 读取 viewSchema（含动态覆盖）和诊断信息，
    // 合并 key、清洗后的 placeholder 和 componentProps，以及调试元数据
    const viewState: FieldNodeViewState<TValues> = {
      view: createComputed(() => {
        const schema = runtimeState.viewSchema.value

        const diagnostics = runtimeState.diagnostics.value

        return {
          ...schema,
          key: node.key,
          placeholder: sanitizePlaceholder(schema.placeholder),
          componentProps: sanitizeComponentProps(schema.componentProps ?? {}),
          debug: {
            runtimeNodeId: node.id,
            runtimeNodeType: "field",
            hasRuntimeState: true,
            hasDependencyEffect: false,
            lastUpdatedBy: diagnostics.lastUpdatedBy,
            overriddenKeys: diagnostics.overriddenKeys,
            error: diagnostics.error?.message ?? null,
          },
        } as unknown as SchemxViewFieldSchema<TValues>
      }),
    }

    node.viewState = viewState

    return viewState
  }

  if (isGroupRuntimeNode(node) && isGroupDescriptor(descriptor)) {
    const runtimeState = node.containerState

    if (!runtimeState) {
      throw new Error(`[schemx] containerState is required for group node "${node.key}"`)
    }

    // 分组 view 合并容器有效状态，并递归读取子节点 viewSchemas。
    const viewState: GroupViewState<TValues> = {
      view: createComputed(() => {
        const effective = runtimeState.effectiveState.value

        return {
          ...descriptor.staticSchema,
          key: node.key,
          visible: effective.visible,
          readonly: effective.readonly,
          disabled: effective.disabled,
          children: readChildrenViewSchemas(node.childNodes.value),
          debug: {
            runtimeNodeId: node.id,
            runtimeNodeType: "group",
            hasRuntimeState: true,
            hasDependencyEffect: descriptor.dynamicProps != null,
          },
        } as SchemxViewGroupSchema<TValues>
      }),
    }

    node.viewState = viewState

    return viewState
  }

  if (isDependencyRuntimeNode(node) && isDependencyDescriptor(descriptor)) {
    // dependency 节点本身不产生 ViewSchema，其 view 直接返回子节点的 schema 数组
    const viewState: DependencyViewState<TValues> = {
      view: createComputed(() => readChildrenViewSchemas(node.childNodes.value)),
    }

    node.viewState = viewState

    return viewState
  }

  throw new Error(
    `[schemx] Cannot create viewState for node "${node.key}" with descriptor "${descriptor.type}".`
  )
}

/**
 * 更新 RuntimeNode 对应 ViewState。
 *
 * 当前实现直接委托给 createRuntimeViewState 重建整个 viewState，
 * 因为 computed 会在运行时自动响应依赖变化，不需要增量更新。
 *
 * @param node - 待更新的运行时节点。
 * @param descriptor - 节点对应的 descriptor。
 * @param resources - 运行时资源上下文。
 * @returns 更新后的视图状态。
 */
export function updateRuntimeViewState<TValues extends Values = Values>(
  node: DescribedRuntimeNode<TValues>,
  descriptor: FormDescriptor<TValues>,
  resources: RuntimeNodeResourceContext<TValues>
): RuntimeViewState<TValues> {
  return createRuntimeViewState(node, descriptor, resources)
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
  node: RuntimeNode<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>
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
  children: readonly DescribedRuntimeNode<TValues>[]
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

/**
 * 清洗 placeholder 值，限制长度不超过 1000 字符。
 *
 * @param value - 原始 placeholder。
 * @returns 清洗后的 placeholder，超长时截断。
 */
function sanitizePlaceholder(value: string | undefined): string {
  return value ? value.slice(0, 1000) : ""
}

/**
 * 清洗 componentProps，递归过滤非法属性 key。
 *
 * 只保留符合标识符命名规范（字母/数字/下划线/美元符号/连字符）的 key，
 * 嵌套对象最多递归 10 层以防止循环引用。
 *
 * @param props - 原始 componentProps。
 * @param depth - 当前递归深度。
 * @returns 清洗后的只读属性对象。
 */
function sanitizeComponentProps<TValues extends Values = Values>(
  props: SchemxComponentProps<TValues>,
  depth = 0
): Readonly<Record<string, unknown>> {
  // 超过 10 层深度直接返回空对象，防止循环引用
  if (depth > 10) {
    return {}
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.keys(props)) {
    // 只保留合法的标识符 key（驼峰或连字符格式）
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) && !/^[a-zA-Z0-9_-]+$/.test(key)) {
      continue
    }

    const value = (props as Record<string, unknown>)[key]

    // 嵌套对象递归清洗
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeComponentProps(
        value as SchemxComponentProps<TValues>,
        depth + 1
      )
    } else {
      result[key] = value
    }
  }

  return result
}
