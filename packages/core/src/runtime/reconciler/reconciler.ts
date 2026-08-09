import { isGroupSchema } from "../../utils"
import { createFieldKey } from "../../utils/path"
import { CompileError } from "../compiler"
import { createRuntimeLifecycle } from "../node/runtimeLifecycle"
import { createRuntimeNodeManager } from "../node/runtimeNodeManager"

import type { SchemxField, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type {
  ParentRuntimeNode,
  RootRuntimeNode,
  RuntimeNode,
  RuntimeNodeInput,
  SchemaRuntimeNode,
} from "../node"

/** 将 schema 子列表协调为 RuntimeNode 子树。 */
export interface Reconciler<TValues extends Values = Values> {
  /** 创建并返回透明根节点。 */
  createRoot(): RootRuntimeNode<TValues>
  /** 将 Schema 子列表协调为父节点的 RuntimeNode 子树。 */
  reconcileChildren(
    parent: ParentRuntimeNode<TValues>,
    schemas: readonly SchemxField<TValues>[]
  ): void
  /** 根据新的 Schema 更新现有 RuntimeNode。 */
  updateNode(
    node: SchemaRuntimeNode<TValues>,
    schema: SchemxField<TValues>,
    index: number
  ): void
  /** 卸载并移除指定节点及其子树。 */
  removeNode(node: RuntimeNode<TValues>): void
}

/** 创建 RuntimeNode 协调器。 */
export function createReconciler<TValues extends Values = Values>(
  context: SchemaRuntimeContext<TValues>
): Reconciler<TValues> {
  const nodeManager = createRuntimeNodeManager(context)

  const lifecycle = createRuntimeLifecycle(context)

  const createRoot = (): RootRuntimeNode<TValues> => nodeManager.createRoot()

  const removeNode = (node: RuntimeNode<TValues>): void => {
    lifecycle.unmountSubtree(node)
    nodeManager.removeSubtree(node)
  }

  const updateNode = (
    node: SchemaRuntimeNode<TValues>,
    schema: SchemxField<TValues>,
    index: number
  ): void => {
    const input = context.compile.compileNode(schema, getParentKey(node.parent), index)

    if (node.configToken !== input.configToken) {
      lifecycle.update(node, input)
    }
  }

  const reconcileChildren = (
    parent: ParentRuntimeNode<TValues>,
    schemas: readonly SchemxField<TValues>[]
  ): void => {
    const currentByKey = indexCurrentChildren(parent.childNodes.value)

    const nextEntries: ReconcileEntry<TValues>[] = []

    const updates: Array<{ node: SchemaRuntimeNode<TValues>; input: RuntimeNodeInput<TValues> }> = []

    const mounts: SchemaRuntimeNode<TValues>[] = []

    const nextKeys = new Set<string>()

    validateFieldUniqueness(context, parent, schemas)

    for (let index = 0; index < schemas.length; index += 1) {
      const schema = schemas[index]

      const input = context.compile.compileNode(schema, getParentKey(parent), index)

      if (nextKeys.has(input.key)) {
        throw new CompileError(`[schemx] Duplicate runtime node key "${input.key}".`, schema)
      }

      nextKeys.add(input.key)
      const current = currentByKey.get(input.key)

      const canReuse = current?.type === input.type

      const node = canReuse
        ? current
        : nodeManager.createNode({ input, parent, dispose: parent.dispose.child() })

      if (canReuse) {
        currentByKey.delete(input.key)

        if (node.configToken !== input.configToken) {
          updates.push({ node, input })
        }
      } else {
        mounts.push(node)
      }

      nextEntries.push({ node, schema })
    }

    mountNodes(lifecycle, nodeManager, mounts)

    for (const { node, input } of updates) {
      lifecycle.update(node, input)
    }

    nodeManager.replaceChildren(
      parent,
      nextEntries.map((entry) => entry.node)
    )

    for (const node of currentByKey.values()) {
      removeNode(node)
    }

    for (const { node, schema } of nextEntries) {
      if (node.type === "group" && isGroupSchema(schema)) {
        reconcileChildren(node, schema.children)
      }
    }
  }

  return {
    createRoot,
    reconcileChildren,
    updateNode,
    removeNode,
  }
}

/**
 * 挂载本轮新节点；任一节点失败时释放此前已创建的全部节点。
 */
function mountNodes<TValues extends Values>(
  lifecycle: ReturnType<typeof createRuntimeLifecycle<TValues>>,
  nodeManager: ReturnType<typeof createRuntimeNodeManager<TValues>>,
  nodes: readonly SchemaRuntimeNode<TValues>[]
): void {
  const mountedNodes: SchemaRuntimeNode<TValues>[] = []

  try {
    for (const node of nodes) {
      lifecycle.mount(node)
      mountedNodes.push(node)
    }
  } catch (error) {
    for (const node of [...mountedNodes].reverse()) {
      lifecycle.unmountSubtree(node)
      nodeManager.removeSubtree(node)
    }

    for (const node of nodes) {
      if (!node.disposed.value) {
        nodeManager.removeSubtree(node)
      }
    }

    throw error
  }
}

/**
 * 在提交前验证字段名在整棵 Runtime 树中的唯一性。
 */
function validateFieldUniqueness<TValues extends Values>(
  context: SchemaRuntimeContext<TValues>,
  parent: ParentRuntimeNode<TValues>,
  schemas: readonly SchemxField<TValues>[]
): void {
  const locations = new Map<string, SchemaLocation>()

  const currentSubtreeNodes = collectSubtreeNodes(parent)

  const visit = (items: readonly SchemxField<TValues>[], location: string): void => {
    for (let index = 0; index < items.length; index += 1) {
      const schema = items[index]

      const schemaLocation = `${location}[${index}]`

      if (isGroupSchema(schema)) {
        visit(schema.children, `${schemaLocation}.children`)
        continue
      }

      if (!("name" in schema)) {
        continue
      }

      const fieldKey = createFieldKey(schema.name)

      const previous = locations.get(fieldKey)

      if (previous) {
        throw new CompileError(
          `[schemx] Duplicate field name "${schema.name}" at ${previous.location} and ${schemaLocation}.`,
          schema
        )
      }

      const existing = context.runtimeRegistry.fieldIndex.get(schema.name)

      if (existing && !currentSubtreeNodes.has(existing)) {
        throw new CompileError(
          `[schemx] Duplicate field name "${schema.name}" at ${schemaLocation}; it is already used by runtime node "${existing.key}".`,
          schema
        )
      }

      locations.set(fieldKey, { location: schemaLocation })
    }
  }

  visit(schemas, "schemas")
}

/** 已挂载的当前子树节点集合，用于识别本轮允许替换的字段。 */
function collectSubtreeNodes<TValues extends Values>(
  root: ParentRuntimeNode<TValues>
): Set<RuntimeNode<TValues>> {
  const nodes = new Set<RuntimeNode<TValues>>([root])

  const visit = (node: RuntimeNode<TValues>): void => {
    if (node.type === "field") {
      return
    }

    for (const child of node.childNodes.value) {
      nodes.add(child)
      visit(child)
    }
  }

  visit(root)

  return nodes
}

/** 单次协调中保留节点与原始 schema 的对应关系。 */
interface ReconcileEntry<TValues extends Values> {
  /** 单次协调中保留的运行时节点。 */
  readonly node: SchemaRuntimeNode<TValues>
  /** 与节点对应的原始 Schema。 */
  readonly schema: SchemxField<TValues>
}

/** 字段 schema 的源码位置，用于生成可定位的重复字段异常。 */
interface SchemaLocation {
  /** Schema 在输入树中的可读位置。 */
  readonly location: string
}

/** 索引当前子节点，并拒绝破坏 keyed 协调前提的重复 key。 */
function indexCurrentChildren<TValues extends Values>(
  children: readonly SchemaRuntimeNode<TValues>[]
): Map<string, SchemaRuntimeNode<TValues>> {
  const result = new Map<string, SchemaRuntimeNode<TValues>>()

  for (const child of children) {
    if (result.has(child.key)) {
      throw new Error(`[schemx] Duplicate current runtime node key "${child.key}".`)
    }

    result.set(child.key, child)
  }

  return result
}

/** Group 子树使用 group key，其余容器从根开始生成 key。 */
function getParentKey<TValues extends Values>(
  parent: ParentRuntimeNode<TValues> | null
): string {
  return parent?.type === "group" ? parent.key : ""
}
