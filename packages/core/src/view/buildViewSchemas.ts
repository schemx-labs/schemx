/**
 * buildViewSchemas - 渲染 schema 构建算法。
 *
 * 从 RuntimeNode Tree 生成处理后的 SchemxField 风格 schema。
 * 核心原则：
 * - dependency RuntimeNode 透明展开
 * - group 保留 children 结构
 * - field 保持扁平 schema 格式
 * - disposed RuntimeNode 被跳过
 *
 * @module core/view/buildViewSchemas
 */

import {
  getChildRuntimeNodes,
  isDependencyRuntimeNode,
  isFieldRuntimeNode,
  isGroupRuntimeNode,
} from "../node"

import type {
  SchemxViewDebugMeta,
  SchemxViewFieldSchema,
  SchemxViewGroupSchema,
  SchemxViewSchema,
} from "./types"
import type {
  DependencyRuntimeNode,
  FieldRuntimeNode,
  GroupRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
} from "../node"
import type { SchemxComponentProps, SchemxResolvedBaseField, Values } from "../types"

/**
 * 安全深度限制。
 */
const MAX_DEPTH = 100

/**
 * 从 Root RuntimeNode 构建 ViewSchemas。
 *
 * root RuntimeNode 是透明的，返回 root.childNodes 的构建结果，而非 root 自身。
 *
 * @param root - root runtime 节点；为空时返回空数组。
 * @returns 可供渲染层消费的 ViewSchemas。
 */
export function buildViewSchemas<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues> | null | undefined
): readonly SchemxViewSchema<TValues>[] {
  if (!root) {
    return []
  }

  // TODO: 按脏 RuntimeNode 缓存 ViewSchema，复用未变化字段的构建结果；
  // node 结构变化时需要使受影响的 group 和 dependency 子树缓存失效。
  return buildRuntimeNodeChildren<TValues>(getChildRuntimeNodes(root), 1)
}

/**
 * 递归构建 RuntimeNode 子节点。
 */
function buildRuntimeNodeChildren<TValues extends Values = Values>(
  nodes: RuntimeNode<TValues>[],
  depth: number
): readonly SchemxViewSchema<TValues>[] {
  if (depth > MAX_DEPTH) {
    throw new RangeError(
      `buildViewSchemas: max depth ${MAX_DEPTH} exceeded at depth ${depth}`
    )
  }

  const results: SchemxViewSchema<TValues>[] = []

  for (const node of nodes) {
    const schema = buildRuntimeNodeSchema<TValues>(node, depth)

    if (schema === null) {
      continue
    }

    if (Array.isArray(schema)) {
      for (const child of schema) {
        results.push(child)
      }

      continue
    }

    results.push(schema as SchemxViewSchema<TValues>)
  }

  return results
}

/**
 * 构建单个 RuntimeNode 对应的 ViewSchema。
 */
function buildRuntimeNodeSchema<TValues extends Values = Values>(
  node: RuntimeNode<TValues>,
  depth: number
): SchemxViewSchema<TValues> | readonly SchemxViewSchema<TValues>[] | null {
  if (node.disposed.value) {
    return null
  }

  if (isGroupRuntimeNode(node)) {
    return buildGroupViewSchema<TValues>(node, depth)
  }

  if (isDependencyRuntimeNode(node)) {
    return buildDependencyRuntimeNode<TValues>(node, depth)
  }

  if (isFieldRuntimeNode(node)) {
    return buildFieldViewSchema<TValues>(node)
  }

  return null
}

/**
 * 将 FieldModel 构建为字段 ViewSchema。
 */
function buildFieldViewSchema<TValues extends Values = Values>(
  node: FieldRuntimeNode<TValues>
): SchemxViewFieldSchema<TValues> | null {
  const descriptor = node.descriptor
  const model = node.fieldModel

  if (!model) {
    console.warn(
      `[buildViewSchemas] skipping field node "${node.key}": no FieldModel resource`
    )

    return null
  }

  if (descriptor?.type !== "field") {
    return null
  }

  const schema = descriptor.schema as SchemxResolvedBaseField<TValues>
  const snapshot = model.snapshot.value

  return {
    ...schema,
    key: node.key,
    visible: snapshot.visible,
    label: snapshot.label,
    readonly: snapshot.readonly,
    disabled: snapshot.disabled,
    required: snapshot.required,
    placeholder: sanitizePlaceholder(snapshot.placeholder),
    componentProps: sanitizeComponentProps(snapshot.componentProps ?? {}),
    rules: snapshot.rules,
    validationTrigger: schema.validationTrigger,
    debug: buildDebugMeta(node),
  }
}

/**
 * 将 group RuntimeNode 构建为分组 ViewSchema。
 */
function buildGroupViewSchema<TValues extends Values = Values>(
  node: GroupRuntimeNode<TValues>,
  depth: number
): SchemxViewGroupSchema<TValues> {
  const children = buildRuntimeNodeChildren<TValues>(
    getChildRuntimeNodes(node),
    depth + 1
  )
  const descriptor = node.descriptor

  return {
    ...descriptor.schema,
    key: node.key,
    children,
    debug: buildDebugMeta(node),
  } as SchemxViewGroupSchema<TValues>
}

function buildDependencyRuntimeNode<TValues extends Values = Values>(
  node: DependencyRuntimeNode<TValues>,
  depth: number
): readonly SchemxViewSchema<TValues>[] {
  return buildRuntimeNodeChildren<TValues>(getChildRuntimeNodes(node), depth + 1)
}

/**
 * 截断 placeholder 到 1000 字符。
 */
function sanitizePlaceholder(value: string): string {
  return value.length > 1000 ? value.slice(0, 1000) : value
}

/**
 * 清理 componentProps。
 *
 * - 校验键名格式
 * - 限制嵌套深度
 * - 浅拷贝防止内部引用泄漏
 */
function sanitizeComponentProps<TValues extends Values = Values>(
  props: SchemxComponentProps<TValues>,
  depth: number = 0
): Readonly<Record<string, unknown>> {
  if (depth > 10) {
    return {}
  }

  const result: Record<string, unknown> = {}

  for (const key of Object.keys(props)) {
    if (!isValidPropKey(key)) {
      continue
    }

    const value = (props as Record<string, unknown>)[key]

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeComponentProps(value, depth + 1)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * 校验 componentProps 键名格式。
 */
function isValidPropKey(key: string): boolean {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return true
  }

  if (/^[a-zA-Z0-9_-]+$/.test(key)) {
    return true
  }

  return false
}

/**
 * 构建调试元数据。
 */
function buildDebugMeta<TValues extends Values = Values>(
  node: RuntimeNode<TValues>
): Readonly<SchemxViewDebugMeta> {
  return {
    runtimeNodeId: node.id,
    runtimeNodeType: node.type,
    hasFieldModel: node.type === "field" && node.fieldModel !== undefined,
    hasDependencySlot: node.type === "dependency" && node.dependencySlot !== undefined,
  }
}
