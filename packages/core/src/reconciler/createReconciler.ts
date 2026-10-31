/**
 * Node 协调器。
 *
 * 统一编排 Compiler、NodeManager、节点资源与生命周期通知。
 *
 * @module core/reconciler/createReconciler
 */

import { CompileError, createNodeKey } from "../compiler"
import { rebaseDynamicSchemas } from "../dynamic"
import { reconcileRows } from "../dynamic/rows"
import { createLifecycle } from "../lifecycle"
import {
  captureNodeUpdate,
  createNodeSnapshot,
  disposeNodeResources,
  isDependencyNode,
  isDynamicNode,
  isFieldNode,
  isGroupNode,
  isParentNode,
  isRootNode,
  mountNodeResources,
  unmountNodeResources,
  updateNodeResources,
} from "../node"
import { batchUpdates, runSignalUntracked } from "../reactivity"
import {
  createFieldKey,
  getSchemaKind,
  isDependencySchema,
  isDescendantFieldPath,
  isDynamicSchema,
  isFieldSchema,
  isGroupSchema,
  isValidSchema,
} from "../utils"

import type { SchemaCompiler, SchemaCompileResult } from "../compiler"
import type { ContainerNode, NodeId, ParentNode, SchemaNode } from "../node"
import type { NodeLifecycleHooks, NodeSnapshot } from "../node/snapshot"
import type { ChildReconciler, FormRuntimeContext } from "../runtimeContext"
import type { NamePath, SchemxField, Values } from "../types"

/**
 * Node 协调器的唯一公开接口。
 *
 * Reconciler 根据 Schema 编译纯配置，与当前树按 key 进行复用、移动、更新或
 * 删除，完成对应资源操作后调用生命周期钩子。
 *
 * @typeParam TValues - 表单值类型。
 *
 * @example
 * ```ts
 * reconciler.reconcile(schemas)
 * ```
 */
export interface Reconciler<
  TValues extends Values = Values,
> extends ChildReconciler<TValues> {
  /**
   * 使用完整根 Schema 协调整棵 Node 树。
   *
   * @param schemas - 新一轮根节点 Schema 列表。
   */
  reconcile(schemas: readonly SchemxField<TValues>[]): void
  /**
   * 使用最近一次成功提交的 Schema 刷新已挂载节点的静态配置。
   */
  refresh(): void
  /**
   * 清空全部 SchemaNode，保留 root。
   */
  clear(): void
}

interface CreateReconcilerOptions<TValues extends Values> {
  // 编译纯配置，仅为新增节点创建身份和运行资源。
  readonly compiler: SchemaCompiler<TValues>
  // 节点树和资源操作所需的基础服务。
  readonly context: FormRuntimeContext<TValues>
  // 资源操作完成后通知业务钩子，不承担资源处理。
  readonly lifecycleHooks?: NodeLifecycleHooks<TValues>
}

interface NodeUpdate<TValues extends Values> {
  // 树中被复用的当前节点。
  readonly current: SchemaNode<TValues>
  // 不持有节点资源的下一轮编译配置。
  readonly desired: SchemaCompileResult<TValues>
}

/**
 * 保留原始 Schema 与纯编译结果的对应关系，供 Group 子树递归使用。
 * @typeParam TValues - 表单值类型。
 */
interface DesiredSchema<TValues extends Values> {
  /**
   * 通过结构校验的原始 Schema。
   */
  readonly schema: SchemxField<TValues>
  /**
   * 已合并默认值并可能命中缓存的纯配置。
   */
  readonly config: SchemaCompileResult<TValues>
  /**
   * Group 的静态子树预编译结果；动态生成的子树独立提交。
   */
  readonly children?: readonly DesiredSchema<TValues>[]
}

/**
 * 单次 children 协调产生的新节点和待清理旧节点。
 */
interface ReconcileNodeResult<TValues extends Values> {
  /**
   * 协调完成后的直接子节点，顺序与输入 Schema 一致。
   */
  readonly children: readonly SchemaNode<TValues>[]
  /**
   * 已从树中移除、等待生命周期清理的节点。
   */
  readonly removed: readonly ContainerNode<TValues>[]
  /**
   * 改名后等待整批协调完成再判断是否清理的旧路径。
   */
  readonly deferredValueRemovals: readonly NamePath<TValues>[]
}

/**
 * 创建 Node 协调器。
 *
 * @typeParam TValues - 表单值类型。
 * @param options - Compiler、Runtime 基础服务和生命周期通知入口。
 * @returns 新的 Reconciler 实例。
 *
 * @example
 * ```ts
 * const reconciler = createReconciler({ compiler, context, lifecycleHooks })
 * reconciler.reconcile(schemas)
 * ```
 */
export function createReconciler<TValues extends Values>(
  options: CreateReconcilerOptions<TValues>
): Reconciler<TValues> {
  // 编译、资源操作和钩子通知由协调器按阶段组织。
  const { compiler, context, lifecycleHooks = {} } = options

  // 独立生命周期模块只负责通知和异常隔离，协调器决定阶段与快照时机。
  const lifecycle = createLifecycle<NodeSnapshot<TValues>>(lifecycleHooks)

  // 活动节点树使用基础服务中的唯一节点管理器。
  const nodeManager = context.nodeManager

  // 只保存各容器最近成功提交的原始 Schema，用于刷新与行路径重定位。
  const committedSchemas = new Map<NodeId, readonly SchemxField<TValues>[]>()

  // 同一次协调中的递归和同步子树提交共用旧路径队列，最外层结束后统一清理。
  let pendingValueRemovals: NamePath<TValues>[] | undefined

  /**
   * 以 root 为父节点协调整棵 Schema 树。
   *
   * @param schemas - 新一轮根节点 Schema 列表。
   */
  const reconcile = (schemas: readonly SchemxField<TValues>[]): void => {
    reconcileChildren(nodeManager.getRoot().id, schemas)
  }

  /**
   * 在同一批次中关联行身份、生成子 Schema 并提交行与节点结构。
   * @param parentId - 接收行和子树的 Dynamic 节点 ID。
   * @param options - Store 行 key、Schema 展开回调和值保留策略。
   * @example reconciler.reconcileArray(array.id, { keys, createSchemas: expandRows })
   */
  const reconcileArray: ChildReconciler<TValues>["reconcileArray"] = (
    parentId,
    options
  ) => {
    runSignalUntracked(() => {
      batchUpdates(() => {
        // 数组协调只接受已挂载的 Dynamic 容器。
        const parent = requireParentNode(parentId)

        if (!isDynamicNode(parent)) {
          throw new Error(`[schemx] Node "${parentId}" is not a Dynamic node.`)
        }

        // 保存已提交的行结构，子 Schema 校验失败时恢复其索引。
        const previousRows = parent.dynamicRows.peek()

        // 行身份由 Compiler 创建，匹配时只使用 Store 的稳定 key。
        const rows = reconcileRows({
          previous: previousRows,
          keys: options.keys,
          path: String(parent.compiledSchema.peek().name),
          createRow: compiler.createDynamicRow,
        })

        // 先展开模板；展开失败不会提交行或索引。
        const schemas = options.createSchemas(rows)

        nodeManager.setArrayRows(parentId, rows)

        try {
          reconcileChildren(parentId, schemas, options.preserveValues)
        } catch (error) {
          nodeManager.setArrayRows(parentId, previousRows)
          throw error
        }
      })
    })
  }

  /**
   * 先校验字段路径并完成纯配置编译，再协调当前 parent 的直接 children。
   *
   * @param parentId - 要协调的父节点 id。
   * @param schemas - 新一轮直接子节点 Schema 列表。
   * @param preserveValues - Store 已提交数据时跳过旧路径删值。
   * @param preparedSchemas - 父级已完成校验的静态子树；独立提交时重新校验。
   * @param preparedChildren - 父级已完成编译的 Group 子树，避免提交后才发生编译错误。
   */
  const reconcileChildren = (
    parentId: NodeId,
    schemas: readonly SchemxField<TValues>[],
    preserveValues = false,
    preparedSchemas?: ReadonlySet<SchemxField<TValues>>,
    preparedChildren?: readonly DesiredSchema<TValues>[]
  ): void => {
    // 只有最外层调用负责结束当前清理批次。
    const isOutermost = pendingValueRemovals === undefined

    // 后续兄弟 Group 仍可能接管旧路径，因此嵌套调用只收集候选路径。
    const valueRemovals = pendingValueRemovals ?? []

    pendingValueRemovals = valueRemovals

    try {
      // 当前提交的父节点。
      const parent = requireParentNode(parentId)

      // 静态 Group 递归复用本轮校验结果，异步生成的子树独立校验。
      const validSchemas = preparedSchemas ?? prepareSchemas(parent, schemas)

      if (!preparedSchemas) {
        validateRuntimeFieldNames(parent, schemas, validSchemas)
      }

      // 全部候选先完成纯编译，编译失败时尚未创建 Scope 或修改树。
      const desiredSchemas =
        preparedChildren ?? compileSchemas(parent.key, schemas, validSchemas)

      // 当前直接子节点的协调结果；config 为候选纯配置。
      const result = reconcileNode(
        parent,
        desiredSchemas.map(({ config }) => config)
      )

      if (!preserveValues) {
        valueRemovals.push(...result.deferredValueRemovals)
      }

      try {
        // index 对应本轮直接子 Schema 的位置。
        for (let index = 0; index < desiredSchemas.length; index += 1) {
          // 用原始 Schema 递归展开 Group 子树。
          const desired = desiredSchemas[index]

          // 同一位置实际保留或新增的节点。
          const node = result.children[index]

          if (
            node &&
            desired &&
            isGroupNode(node) &&
            isGroupSchema<TValues>(desired.schema)
          ) {
            reconcileChildren(
              node.id,
              desired.schema.children,
              preserveValues,
              validSchemas,
              desired.children
            )
          }
        }
      } finally {
        cleanupRemovedNodes(result.removed, preserveValues)
      }

      committedSchemas.set(parent.id, schemas)
    } finally {
      if (isOutermost) {
        pendingValueRemovals = undefined
        cleanupDeferredFieldValues(valueRemovals)
      }
    }
  }

  // 数组数据已由 Store 移动；路径重定位不能再按 preserve 删除旧索引值。
  const rebaseChildren: Reconciler<TValues>["rebaseChildren"] = (parentId, from, to) => {
    const schemas = committedSchemas.get(parentId)

    if (schemas) {
      reconcileChildren(parentId, rebaseDynamicSchemas(schemas, from, to), true)
    }
  }

  // 资源层复用同一组协调方法，创建生命周期门面时无需反向引用 Reconciler。
  const childReconciler: ChildReconciler<TValues> = {
    reconcileArray,
    reconcileChildren,
    rebaseChildren,
  }

  /**
   * 使用最近成功提交的原始 Schema 刷新默认配置。
   *
   * Root/Group 子树会由普通递归协调刷新；Dependency/Dynamic 的 renderer 输出不会
   * 重新执行，而是使用上次成功结果再次协调，使默认配置能传播到已生成字段。
   */
  const refresh = (): void => {
    // 根节点与已生成子树先全部编译，后续编译失败不能留下已应用的父级状态。
    const parents = [
      nodeManager.getRoot(),
      ...nodeManager
        .values()
        .filter((node) => isDependencyNode(node) || isDynamicNode(node)),
    ]

    // parent 是配置刷新前已挂载的容器，只有成功提交过 Schema 的容器参与刷新。
    const prepared = parents.flatMap((parent) => {
      const schemas = committedSchemas.get(parent.id)

      if (!schemas) {
        return []
      }

      // 每份输入只在准备阶段校验和编译一次，提交阶段复用结果。
      const validSchemas = prepareSchemas(parent, schemas)

      validateRuntimeFieldNames(parent, schemas, validSchemas)

      return [
        {
          parentId: parent.id,
          schemas,
          validSchemas,
          children: compileSchemas(parent.key, schemas, validSchemas),
        },
      ]
    })

    // next 为本轮已编译成功的容器；祖先更新移除的旧容器不再提交。
    for (const next of prepared) {
      if (nodeManager.has(next.parentId)) {
        reconcileChildren(
          next.parentId,
          next.schemas,
          false,
          next.validSchemas,
          next.children
        )
      }
    }
  }

  // NodeManager 只解除树结构，资源释放由 reconciler 补齐。
  const clear = (): void => {
    cleanupRemovedNodes(nodeManager.clear())
    committedSchemas.clear()
  }

  /**
   * 获取可承载子节点的父节点。
   *
   * @param parentId - 要读取的父节点 id。
   * @returns 合法的 ParentNode。
   * @throws 当节点不存在或为 field 节点时抛出错误。
   */
  function requireParentNode(parentId: NodeId): ParentNode<TValues> {
    const node = nodeManager.get(parentId)

    if (!node) {
      throw new Error(`[schemx] Node "${parentId}" does not exist`)
    }

    if (!isParentNode(node)) {
      throw new Error(`[schemx] Node "${parentId}" cannot contain children`)
    }

    return node
  }

  /**
   * 按本次提交后的候选树检查字段路径冲突。
   *
   * 当前 parent 子树会被候选 Schema 替换，因此先从占用表中排除该子树，再把
   * 候选字段和仍会复用的 Dependency/Dynamic 输出加入检查，避免迁移时误报或
   * 静态字段遮蔽已生成字段。
   */
  function validateRuntimeFieldNames(
    parent: ParentNode<TValues>,
    schemas: readonly SchemxField<TValues>[],
    validSchemas: ReadonlySet<SchemxField<TValues>>
  ): void {
    // Dynamic 行是逐个 Dependency effect 提交的；数组重排期间其他行仍保留上一轮
    // 索引，不能把这种短暂重叠当成最终 Schema 冲突。
    if (hasDynamicAncestor(parent)) {
      return
    }

    const fields = new Map<
      string,
      { readonly location: string; readonly runtimeKey?: string }
    >()

    const excludedNodeIds = new Set(
      nodeManager.getDescendants(parent.id).map((node) => node.id)
    )

    for (const current of nodeManager.values()) {
      if (!isFieldNode(current) || excludedNodeIds.has(current.id)) {
        continue
      }

      fields.set(createFieldKey(current.name.peek()), {
        location: "runtime",
        runtimeKey: current.key,
      })
    }

    const addField = (
      name: NamePath<TValues>,
      location: string,
      schema: SchemxField<TValues>
    ): void => {
      const fieldKey = createFieldKey(name)

      const previous = fields.get(fieldKey)

      if (previous) {
        if (previous.runtimeKey) {
          throw new CompileError(
            `[schemx] Duplicate field name "${name}" at ${location}; it is already used by runtime node "${previous.runtimeKey}".`,
            schema
          )
        }

        throw new CompileError(
          `[schemx] Duplicate field name "${name}" at ${previous.location} and ${location}.`,
          schema
        )
      }

      fields.set(fieldKey, { location })
    }

    const visit = (
      items: readonly SchemxField<TValues>[],
      currentParent: ParentNode<TValues>,
      parentKey: string,
      location: string,
      filterDirect = false
    ): void => {
      // 容器候选按 key 复用，普通字段不需要查找旧节点。
      const currentByKey = indexCurrentNodes(nodeManager.getChildren(currentParent.id))

      for (let index = 0; index < items.length; index += 1) {
        const schema = items[index]

        if (!schema || (filterDirect && !validSchemas.has(schema))) {
          continue
        }

        const schemaLocation = `${location}[${index}]`

        if (isFieldSchema<TValues>(schema)) {
          addField(schema.name, schemaLocation, schema)
          continue
        }

        // 只有容器需要读取旧节点及其已经生成的子树。
        const key = createNodeKey(schema, index, parentKey)

        const current = currentByKey.get(key)

        if (isGroupSchema<TValues>(schema)) {
          const nestedParent = isGroupNode(current) ? current : currentParent

          visit(schema.children, nestedParent, key, `${schemaLocation}.children`)
          continue
        }

        if (isDynamicSchema<TValues>(schema)) {
          addField(schema.name as NamePath<TValues>, schemaLocation, schema)
        }

        const reusableGeneratedParent =
          (isDependencySchema<TValues>(schema) && isDependencyNode(current)) ||
          (isDynamicSchema<TValues>(schema) && isDynamicNode(current))

        if (reusableGeneratedParent && current) {
          for (const descendant of nodeManager.getDescendants(current.id)) {
            if (isFieldNode(descendant)) {
              addField(descendant.name.peek(), `${schemaLocation}.renderer`, schema)
            }
          }
        }
      }
    }

    visit(schemas, parent, parent.key, "schemas", true)
  }

  /**
   * 判断协调范围是否位于 Dynamic 数组节点下。
   */
  function hasDynamicAncestor(node: ParentNode<TValues>): boolean {
    let current: ContainerNode<TValues> | null = node

    while (current) {
      if (isDynamicNode(current)) {
        return true
      }

      current = current.parent
    }

    return false
  }

  /**
   * 将当前列表和静态 Group 子树编译为纯配置，不建立节点身份或资源。
   *
   * @param parentKey - 配置所属父节点的 key。
   * @param schemas - 待编译的直接子节点 Schema 列表。
   * @param validSchemas - 本次提交已校验的静态子树。
   * @returns 按有效 Schema 顺序排列的原始 Schema 和编译结果。
   * @throws 任一配置编译失败时直接抛出，当前树保持原状。
   */
  function compileSchemas(
    parentKey: string,
    schemas: readonly SchemxField<TValues>[],
    validSchemas: ReadonlySet<SchemxField<TValues>>
  ): DesiredSchema<TValues>[] {
    // 每个条目保留原始输入，编译后的 Group 配置本身不保存静态 children。
    const desiredSchemas: DesiredSchema<TValues>[] = []

    // index 保留过滤无效 Schema 前的原始位置。
    for (let index = 0; index < schemas.length; index += 1) {
      // 当前待编译的原始 Schema。
      const schema = schemas[index]

      if (schema && validSchemas.has(schema)) {
        // 先完成此节点和静态子树编译，再允许协调阶段创建任何节点。
        const config = compiler.compile(schema, parentKey, index)

        desiredSchemas.push({
          schema,
          config,
          children: isGroupSchema<TValues>(schema)
            ? compileSchemas(config.schema.key, schema.children, validSchemas)
            : undefined,
        })
      }
    }

    return desiredSchemas
  }

  /**
   * 在任何树结构提交前完成静态 Schema 校验和递归 key 校验。
   *
   * 该阶段只读取输入并构造校验集合，不创建 Node、不触发生命周期事件，也不修改
   * 当前树；因此嵌套 Group 的重复 key 不会留下已经挂载的空父节点。
   */
  function prepareSchemas(
    parent: ParentNode<TValues>,
    schemas: readonly SchemxField<TValues>[]
  ): ReadonlySet<SchemxField<TValues>> {
    // 记录本轮所有有效静态节点，供 Group 递归直接复用。
    const validSchemas = new Set<SchemxField<TValues>>()

    // 根提交共享字段路径命名空间；数组模板使用自己的相对路径空间。
    const fieldLocations = new Map<string, string>()

    /**
     * 同一轮遍历完成字段命名空间和各层 key 校验。
     * @param items - 当前容器的静态 Schema 或数组模板。
     * @param parentKey - 当前容器用于生成子节点 key 的标识。
     * @param location - 当前列表的诊断位置。
     * @param locations - 当前共享字段空间；数组模板仅校验 key，不登记绝对路径。
     * @param validateStructure - 仅入口列表逐项校验完整静态子树。
     */
    const visitSchemas = (
      items: readonly SchemxField<TValues>[],
      parentKey: string,
      location: string,
      locations: Map<string, string> | undefined,
      validateStructure = false
    ): void => {
      // key 只要求在当前父节点内唯一。
      const keys = new Set<string>()

      // index 为 Schema 在当前列表中的原始位置。
      for (let index = 0; index < items.length; index += 1) {
        // 待校验的当前 Schema。
        const schema = items[index]

        if (!schema || (validateStructure && !isValidSchema(schema))) {
          continue
        }

        // 字段冲突和 key 冲突共用原始位置，过滤输入不改变诊断路径。
        const schemaLocation = `${location}[${index}]`

        if (
          locations &&
          (isFieldSchema<TValues>(schema) || isDynamicSchema<TValues>(schema))
        ) {
          // 当前静态字段或数组根的规范化地址。
          const fieldKey = createFieldKey(schema.name)

          // 同一提交中此前占用此路径的诊断位置。
          const previousLocation = locations.get(fieldKey)

          if (previousLocation) {
            throw new CompileError(
              `[schemx] Duplicate field name "${String(schema.name)}" at ${previousLocation} and ${schemaLocation}.`,
              schema
            )
          }

          locations.set(fieldKey, schemaLocation)
        }

        // 与后续编译使用完全相同的 key 生成规则。
        const key = createNodeKey(schema, index, parentKey)

        if (keys.has(key)) {
          throw new CompileError(`[schemx] Duplicate runtime node key "${key}".`, schema)
        }

        keys.add(key)
        validSchemas.add(schema)

        if (isGroupSchema<TValues>(schema)) {
          visitSchemas(schema.children, key, `${schemaLocation}.children`, locations)
        } else if (isDynamicSchema<TValues>(schema)) {
          // 入口结构校验已确认模板节点的形状，模板只在当前行内解释相对路径。
          visitSchemas(
            schema.item as readonly SchemxField<TValues>[],
            `${key}/__row__`,
            `${schemaLocation}.item`,
            undefined
          )
        }
      }
    }

    visitSchemas(schemas, parent.key, "schemas", fieldLocations, true)

    return validSchemas
  }

  /**
   * 按稳定 key 协调一个父节点的直接 children。
   *
   * 同 key 且同类型的节点会复用；配置 token 变化时更新资源，类型变化或缺失时替换
   * 节点。挂载失败会回滚本轮树结构和已创建资源。
   *
   * @param parent - 当前要协调的父节点。
   * @param desiredConfigs - 本轮纯编译配置，全部成功编译后才进入协调。
   * @returns 协调完成后的直接子节点及待清理旧节点。
   */
  function reconcileNode(
    parent: ParentNode<TValues>,
    desiredConfigs: readonly SchemaCompileResult<TValues>[]
  ): ReconcileNodeResult<TValues> {
    const previousChildren = nodeManager.getChildren(parent.id)

    // 只有协调阶段需要查询活动节点，编译阶段不读取或复用运行对象。
    const currentByKey = indexCurrentNodes(previousChildren)

    const nextChildren: SchemaNode<TValues>[] = []

    const updates: NodeUpdate<TValues>[] = []

    // 收集字段改名的旧路径，避免交换路径期间误删其他节点的数据。
    const deferredValueRemovals: NamePath<TValues>[] = []

    // 只跟踪本轮实际新增的节点，失败时释放；纯配置不参与资源清理。
    const createdNodes: SchemaNode<TValues>[] = []

    const removedNodes: ContainerNode<TValues>[] = []

    try {
      for (const desired of desiredConfigs) {
        const current = currentByKey.get(desired.schema.key)

        currentByKey.delete(desired.schema.key)

        if (!current || current.type !== getSchemaKind<TValues>(desired.schema)) {
          // 新增和类型替换共用唯一的节点创建入口。
          const node = compiler.createNode(desired, parent.scope.child())

          createdNodes.push(node)
          nextChildren.push(node)
          if (current) {
            removedNodes.push(current)
          }

          continue
        }

        nextChildren.push(current)

        if (current.configToken !== desired.configToken) {
          updates.push({ current, desired })
        }
      }

      for (const current of currentByKey.values()) {
        removedNodes.push(current)
      }

      const orderChanged = !areNodeOrdersEqual(previousChildren, nextChildren)

      const canReorderInPlace =
        removedNodes.length === 0 &&
        nextChildren.every((node) => nodeManager.has(node.id))

      nodeManager.transaction(() => {
        if (orderChanged && canReorderInPlace) {
          nodeManager.reorderChildren(parent.id, nextChildren)
        }

        for (let index = 0; index < nextChildren.length; index += 1) {
          const node = nextChildren[index]

          if (!node) {
            continue
          }

          if (nodeManager.has(node.id)) {
            if (orderChanged && !canReorderInPlace) {
              moveNode(node.id, parent.id, index)
            }

            continue
          }

          if (lifecycleHooks.created) {
            lifecycle.created(createNodeSnapshot(node))
          }

          nodeManager.insert(node, parent.id, index)
          mountNodeResources(node, context, childReconciler)
          if (lifecycleHooks.mounted) {
            lifecycle.mounted(createNodeSnapshot(node))
          }
        }
      })

      for (const update of updates) {
        // 普通旧配置用于资源比较；通知快照仅在 updated hook 存在时另行捕获。
        const previousNode = captureNodeUpdate(update.current)

        // 只有业务观察更新时才分配公开通知快照。
        const previousSnapshot = lifecycleHooks.updated
          ? createNodeSnapshot(update.current)
          : undefined

        // 资源操作只报告待清理路径，值清理由最终树的占用情况决定。
        const path = updateNodeResources(
          update.current,
          previousNode,
          update.desired,
          context,
          childReconciler
        )

        if (previousSnapshot) {
          lifecycle.updated(createNodeSnapshot(update.current), previousSnapshot)
        }

        if (path !== undefined) {
          deferredValueRemovals.push(path)
        }
      }
    } catch (error) {
      rollbackTree(parent, previousChildren)

      for (const node of createdNodes) {
        disposeNodeResources(node)
      }

      throw error
    }

    const removed: ContainerNode<TValues>[] = []

    nodeManager.transaction(() => {
      for (const node of removedNodes) {
        removed.push(...nodeManager.remove(node.id))
      }
    })

    return {
      children: nodeManager.getChildren(parent.id),
      removed,
      deferredValueRemovals,
    }
  }

  /**
   * 仅在节点当前位置发生变化时执行移动。
   *
   * @param id - 要移动的节点 id。
   * @param parentId - 目标父节点 id。
   * @param index - 目标位置。
   */
  function moveNode(id: NodeId, parentId: NodeId, index: number): void {
    if (nodeManager.getIndex(id) !== index) {
      nodeManager.move(id, parentId, index)
    }
  }

  /**
   * 从 NodeManager 移除节点，并按卸载后释放的顺序清理资源。
   *
   * @param id - 要移除的节点 id。
   */
  function removeNode(id: NodeId): void {
    cleanupRemovedNodes(nodeManager.remove(id))
  }

  /**
   * 先卸载整棵子树，再释放各节点作用域。
   *
   * @param removed - 按 preorder 排列的已移除节点。
   * @param preserveValues - Store 已处理数组数据时只卸载节点资源。
   */
  function cleanupRemovedNodes(
    removed: readonly ContainerNode<TValues>[],
    preserveValues = false
  ): void {
    // 卸载只释放资源，路径值等待整次协调结束后再判断是否仍被使用。
    const valueRemovals: NamePath<TValues>[] = []

    // node 为已从活动索引移除的节点。
    for (const node of removed) {
      committedSchemas.delete(node.id)
    }

    // node 按子节点先于父节点的顺序卸载。
    for (const node of [...removed].reverse()) {
      if (
        !preserveValues &&
        isFieldNode(node) &&
        node.compiledSchema.peek().preserve === false
      ) {
        valueRemovals.push(node.name.peek())
      }

      if (!isRootNode(node)) {
        unmountNodeResources(node, context)
        if (lifecycleHooks.unmounted) {
          lifecycle.unmounted(createNodeSnapshot(node))
        }
      }
    }

    // node 的领域资源均已卸载，此处释放剩余作用域。
    for (const node of [...removed].reverse()) {
      disposeNodeResources(node)
    }

    if (pendingValueRemovals) {
      pendingValueRemovals.push(...valueRemovals)
    } else {
      cleanupDeferredFieldValues(valueRemovals)
    }
  }

  /**
   * 清理整批提交后不再被字段或后代字段使用的旧路径。
   * @param paths - 字段改名或卸载且旧 Schema 指定 preserve: false 的路径。
   */
  function cleanupDeferredFieldValues(paths: readonly NamePath<TValues>[]): void {
    if (paths.length === 0) {
      return
    }

    // 当前活动字段包含本次新增、移动和复用后的最终地址。
    const fields = nodeManager.values().filter(isFieldNode)

    for (const path of paths) {
      // field 为候选占用者，父路径仍承载活动后代时也保留其值。
      const used = fields.some(
        (field) =>
          createFieldKey(field.name.peek()) === createFieldKey(path) ||
          isDescendantFieldPath(field.name.peek(), path)
      )

      if (!used) {
        context.store.removeFieldValue(path)
      }
    }
  }

  /**
   * 将树结构恢复到协调前状态，并移除本轮已挂载节点。
   *
   * @param parent - 本轮发生协调的父节点。
   * @param previousChildren - 协调前的直接子节点顺序。
   * @param mountedNodes - 本轮已成功挂载的节点。
   */
  function rollbackTree(
    parent: ParentNode<TValues>,
    previousChildren: readonly SchemaNode<TValues>[]
  ): void {
    const previousIds = new Set(previousChildren.map((node) => node.id))

    const currentChildren = nodeManager.getChildren(parent.id)

    nodeManager.transaction(() => {
      for (const node of [...currentChildren].reverse()) {
        if (!previousIds.has(node.id) && nodeManager.has(node.id)) {
          removeNode(node.id)
        }
      }

      for (let index = 0; index < previousChildren.length; index += 1) {
        const node = previousChildren[index]

        if (node && nodeManager.has(node.id)) {
          moveNode(node.id, parent.id, index)
        }
      }
    })
  }

  return {
    reconcile,
    reconcileArray,
    reconcileChildren,
    rebaseChildren,
    refresh,
    clear,
  }
}

/**
 * 按稳定 key 建立当前直接子节点索引。
 *
 * @typeParam TValues - 表单值类型。
 * @param children - 当前父节点的直接子节点。
 * @returns 以节点 key 为键的当前节点映射。
 */
function indexCurrentNodes<TValues extends Values>(
  children: readonly SchemaNode<TValues>[]
): Map<string, SchemaNode<TValues>> {
  const nodesByKey = new Map<string, SchemaNode<TValues>>()

  for (const child of children) {
    nodesByKey.set(child.key, child)
  }

  return nodesByKey
}

/**
 * 判断同一父节点的直接子节点顺序是否已经与目标一致。
 *
 * 原样重复提交时跳过逐节点 getIndex/move，避免在大规模 Schema 下产生无意义的
 * 线性扫描和 childNodes Signal 写入。
 */
function areNodeOrdersEqual<TValues extends Values>(
  previous: readonly SchemaNode<TValues>[],
  next: readonly SchemaNode<TValues>[]
): boolean {
  return (
    previous.length === next.length &&
    previous.every((node, index) => node === next[index])
  )
}
