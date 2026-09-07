/**
 * Dynamic 数组节点资源。
 *
 * 负责订阅数组结构，并把每行的相对 Field/Group 模板展开为当前表单路径。
 * Dynamic Item 中的 Dependency 保留完整表单触发路径，仅包装其 renderer 输出。
 *
 * @module core/runtime/dynamic/resources
 */

import { createSignalEffect, runSignalUntracked } from "../../reactivity"
import {
  createFieldKey,
  getByPath,
  isDependencySchema,
  isDynamicSchema,
  isGroupSchema,
} from "../../utils"

import type {
  FieldArrayPath,
  NamePath,
  SchemxDependencyField,
  SchemxDynamicField,
  SchemxDynamicItemDependency,
  SchemxDynamicItemSchema,
  SchemxField,
  SchemxFormApi,
  Values,
} from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DynamicNode, DynamicRowState } from "../node"

type DynamicDependencyRenderer<
  TItem extends Values,
  TValues extends Values,
> = SchemxDynamicItemDependency<TItem, TValues>["renderer"]

interface CachedDynamicDependencyRenderer<TItem extends Values, TValues extends Values> {
  readonly source: DynamicDependencyRenderer<TItem, TValues>
  readonly renderer: SchemxDependencyField<TValues>["renderer"]
  readonly state: {
    rowPath: string
    rowIndex: number
    dynamicRowKey: string
    activeRendererKeys: Set<string>
  }
}

/**
 * 挂载 Dynamic 数组结构同步 effect。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要挂载的 Dynamic 节点。
 * @param context - Runtime 共享上下文。
 */
export function mountDynamicResources<TValues extends Values>(
  node: DynamicNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  recreateDynamicEffect(node, context)
}

/**
 * 更新 Dynamic 的数组结构同步 effect。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 当前 Dynamic 节点。
 * @param context - Runtime 共享上下文。
 */
export function updateDynamicResources<TValues extends Values>(
  node: DynamicNode<TValues>,
  previousNode: DynamicNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  const previousSchema = previousNode.staticSchema.peek()

  const currentSchema = node.staticSchema.peek()

  if (
    createFieldKey(previousSchema.name) === createFieldKey(currentSchema.name) &&
    previousSchema.item === currentSchema.item
  ) {
    return
  }

  recreateDynamicEffect(node, context)
}

/**
 * 释放 Dynamic 的数组结构同步 effect。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要释放的 Dynamic 节点。
 */
export function unmountDynamicResources<TValues extends Values>(
  node: DynamicNode<TValues>
): void {
  node.dynamicEffectScope?.dispose()
  node.dynamicEffectScope = null
}

/**
 * 创建或重建 Dynamic 的数组结构监听。
 *
 * @typeParam TValues - 表单值类型。
 * @param node - 要监听的 Dynamic 节点。
 * @param context - Runtime 共享上下文。
 */
function recreateDynamicEffect<TValues extends Values>(
  node: DynamicNode<TValues>,
  context: SchemaRuntimeContext<TValues>
): void {
  node.dynamicEffectScope?.dispose()

  const dynamicEffectScope = node.scope.child()

  node.dynamicEffectScope = dynamicEffectScope

  const schema = node.staticSchema.value

  const arrayStructure = context.store.getArrayStructureHandle(
    schema.name as FieldArrayPath<TValues>
  )

  const dependencyRendererCache = new Map<
    string,
    CachedDynamicDependencyRenderer<Values, TValues>
  >()

  arrayStructure.register()

  dynamicEffectScope.add(
    arrayStructure.subscribe((change) => {
      context.validation.invalidateFieldArray(schema.name as NamePath<TValues>, change)
    })
  )

  const disposeEffect = createSignalEffect(() => {
    const rows: DynamicRowState[] = arrayStructure.getKeys().map((key, index) => ({
      key,
      index,
    }))

    const activeRendererKeys = new Set<string>()

    node.dynamicRows.value = rows

    try {
      runSignalUntracked(() => {
        context.reconcileChildren(
          node.id,
          expandDynamicSchemas(schema, rows, dependencyRendererCache, activeRendererKeys)
        )
      })
    } finally {
      for (const cacheKey of dependencyRendererCache.keys()) {
        if (!activeRendererKeys.has(cacheKey)) {
          dependencyRendererCache.delete(cacheKey)
        }
      }
    }
  })

  dynamicEffectScope.add(disposeEffect)
  dynamicEffectScope.add(() => {
    dependencyRendererCache.clear()
  })
  dynamicEffectScope.add(() => {
    if (node.dynamicEffectScope === dynamicEffectScope) {
      node.dynamicEffectScope = null
    }
  })
}

/**
 * 将 Dynamic 的相对行模板展开为当前表单字段 Schema。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - Dynamic 容器配置。
 * @param rows - 当前稳定行结构。
 * @param dependencyRendererCache - 当前 Dynamic 作用域内的 Dependency renderer 缓存。
 * @returns 按行顺序展开的表单 Schema。
 */
function expandDynamicSchemas<TValues extends Values>(
  schema: SchemxDynamicField<TValues>,
  rows: readonly DynamicRowState[],
  dependencyRendererCache: Map<string, CachedDynamicDependencyRenderer<Values, TValues>>,
  activeRendererKeys: Set<string>
): SchemxField<TValues>[] {
  const expanded: SchemxField<TValues>[] = []

  for (const row of rows) {
    const prefix = `${String(schema.name)}.${row.index}`

    for (let index = 0; index < schema.item.length; index += 1) {
      const child = schema.item[index]

      if (!child) {
        continue
      }

      expanded.push(
        expandDynamicSchema(
          child,
          prefix,
          `${schema.key}/${row.key}`,
          index,
          row.index,
          row.key,
          dependencyRendererCache,
          activeRendererKeys
        )
      )
    }
  }

  return expanded
}

/**
 * 递归展开单个 Dynamic 行模板。
 *
 * @typeParam TValues - 表单值类型。
 * @param schema - 当前行模板节点。
 * @param prefix - 当前数组项的绝对路径前缀。
 * @param rowKey - 当前数组行的稳定 key 前缀。
 * @param index - 当前模板节点在父级中的位置。
 * @param rowIndex - 当前 Dynamic 行的数组索引。
 * @param dynamicRowKey - 当前 Dynamic 行的稳定 key。
 * @param dependencyRendererCache - 当前 Dynamic 作用域内的 Dependency renderer 缓存。
 * @returns 可交给普通 Reconciler 的表单 Schema。
 */
function expandDynamicSchema<TValues extends Values>(
  schema: SchemxDynamicItemSchema<Values, TValues>,
  prefix: string,
  rowKey: string,
  index: number,
  rowIndex: number,
  dynamicRowKey: string,
  dependencyRendererCache: Map<string, CachedDynamicDependencyRenderer<Values, TValues>>,
  activeRendererKeys: Set<string>
): SchemxField<TValues> {
  const templateKey = getTemplateKey(schema, index)

  const key = `${rowKey}/${templateKey}`

  if (isDynamicSchema(schema as SchemxField<TValues>)) {
    throw new Error(
      `[schemx] Dynamic item schema cannot contain nested Dynamic Schema: "${key}".`
    )
  }

  if (isDependencySchema(schema as SchemxField<TValues>)) {
    const dependency = schema as SchemxDynamicItemDependency<Values, TValues>

    const expandedDependency = {
      ...dependency,
      key,
      renderer: getDynamicDependencyRenderer(
        dependency,
        prefix,
        key,
        rowIndex,
        dynamicRowKey,
        dependencyRendererCache,
        activeRendererKeys
      ),
    }

    Object.defineProperty(
      expandedDependency,
      Symbol.for("schemx.dynamicDependencyContext"),
      {
        configurable: true,
        enumerable: false,
        value: `${dynamicRowKey}:${prefix}`,
      }
    )

    return expandedDependency as SchemxField<TValues>
  }

  if (isGroupSchema(schema as SchemxField<TValues>)) {
    const group = schema as SchemxField<TValues> & {
      children: readonly SchemxDynamicField<TValues>["item"][number][]
    }

    return {
      ...group,
      key,
      dependencies: prefixDynamicDependencies(
        (group as { dependencies?: unknown }).dependencies,
        prefix
      ),
      children: group.children.map((child, childIndex) =>
        expandDynamicSchema(
          child,
          prefix,
          key,
          childIndex,
          rowIndex,
          dynamicRowKey,
          dependencyRendererCache,
          activeRendererKeys
        )
      ),
    } as SchemxField<TValues>
  }

  const field = schema as SchemxField<TValues> & { name: NamePath<TValues> }

  return {
    ...field,
    key,
    name: joinDynamicPath(prefix, field.name),
    dependencies: prefixDynamicDependencies(
      (field as { dependencies?: unknown }).dependencies,
      prefix
    ),
  } as SchemxField<TValues>
}

/**
 * 创建或复用 Dynamic 行内 Dependency 的 renderer 包装器。
 *
 * 包装器负责注入当前行上下文，并把 renderer 返回的相对 Schema 展开为绝对路径。
 *
 * @typeParam TValues - 表单值类型。
 * @param dependency - Dynamic 行内的 Dependency 配置。
 * @param rowPath - 当前数组行的绝对字段路径。
 * @param dependencyKey - 当前 Dependency 的稳定 key 前缀。
 * @param rowIndex - 当前数组行索引。
 * @param dynamicRowKey - 当前数组行的稳定 key。
 * @param dependencyRendererCache - 当前 Dynamic 作用域内的 renderer 缓存。
 * @returns 可交给普通 Reconciler 的 renderer。
 */
function getDynamicDependencyRenderer<TValues extends Values>(
  dependency: SchemxDynamicItemDependency<Values, TValues>,
  rowPath: string,
  dependencyKey: string,
  rowIndex: number,
  dynamicRowKey: string,
  dependencyRendererCache: Map<string, CachedDynamicDependencyRenderer<Values, TValues>>,
  activeRendererKeys: Set<string>
): SchemxDependencyField<TValues>["renderer"] {
  const cacheKey = dependencyKey

  activeRendererKeys.add(cacheKey)

  const cached = dependencyRendererCache.get(cacheKey)

  if (cached?.source === dependency.renderer) {
    cached.state.rowPath = rowPath
    cached.state.rowIndex = rowIndex
    cached.state.dynamicRowKey = dynamicRowKey
    cached.state.activeRendererKeys = activeRendererKeys

    return cached.renderer
  }

  const state = {
    rowPath,
    rowIndex,
    dynamicRowKey,
    activeRendererKeys,
  }

  const renderer = async (
    values: TValues,
    form: SchemxFormApi<TValues>,
    context: Parameters<SchemxDependencyField<TValues>["renderer"]>[2]
  ): Promise<SchemxField<TValues>[]> => {
    const item = getByPath<TValues, NamePath<TValues>, Values>(
      values,
      state.rowPath as NamePath<TValues>
    )

    if (item === undefined || item === null) {
      return []
    }

    const children = await dependency.renderer(values, form, {
      ...context,
      item,
      rowKey: state.dynamicRowKey,
      rowIndex: state.rowIndex,
      rowPath: state.rowPath as NamePath<TValues>,
    })

    return children.map((child, childIndex) =>
      expandDynamicSchema(
        child,
        state.rowPath,
        `${dependencyKey}/renderer`,
        childIndex,
        state.rowIndex,
        state.dynamicRowKey,
        dependencyRendererCache,
        state.activeRendererKeys
      )
    )
  }

  dependencyRendererCache.set(cacheKey, {
    source: dependency.renderer,
    renderer,
    state,
  })

  return renderer
}

/**
 * 获取模板节点的显式 key 或父级内位置 key。
 *
 * @param schema - 当前模板节点。
 * @param index - 模板节点在父级中的位置。
 * @returns 节点的稳定模板 key。
 */
function getTemplateKey(schema: { readonly key?: string }, index: number): string {
  return "key" in schema && typeof schema.key === "string" && schema.key.length > 0
    ? schema.key
    : String(index)
}

/**
 * 拼接数组项绝对路径和模板相对路径。
 *
 * @param prefix - 当前数组项的绝对路径前缀。
 * @param name - 模板中的相对字段路径。
 * @returns 拼接后的绝对字段路径。
 */
function joinDynamicPath(prefix: string, name: NamePath): string {
  const relativePath = Array.isArray(name) ? name.join(".") : String(name)

  return relativePath.length > 0 ? `${prefix}.${relativePath}` : prefix
}

/**
 * 将 Dynamic 模板中的字段触发路径展开为当前数组项的绝对路径。
 *
 * @param dependencies - 模板中的 dependencies 配置。
 * @param prefix - 当前数组项的绝对路径前缀。
 * @returns 展开触发路径后的 dependencies 配置。
 */
function prefixDynamicDependencies(dependencies: unknown, prefix: string): unknown {
  if (dependencies === null || typeof dependencies !== "object") {
    return dependencies
  }

  const triggerFields = (dependencies as { triggerFields?: unknown }).triggerFields

  if (
    !Array.isArray(triggerFields) ||
    !triggerFields.every(
      (fieldName) => typeof fieldName === "string" || Array.isArray(fieldName)
    )
  ) {
    return dependencies
  }

  return {
    ...dependencies,
    triggerFields: triggerFields.map((fieldName) =>
      joinDynamicPath(prefix, fieldName as NamePath)
    ),
  }
}
