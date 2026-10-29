import { joinDynamicPath } from "./paths"
import { attachDynamicRow } from "./rowContext"

import type { DynamicRowState } from "../node/types"
import type { RuntimeStorePort } from "../runtimeContext"
import type {
  NamePath,
  SchemxContainerDependencies,
  SchemxDependencyField,
  SchemxDynamicField,
  SchemxDynamicItemDependency,
  SchemxDynamicItemSchema,
  SchemxField,
  Values,
} from "../types"

/**
 * 行内 renderer 的稳定包装器和当前行位置。
 * @typeParam TValues - 完整表单值类型。
 */
interface CachedRenderer<TValues extends Values> {
  /**
   * 用户声明的相对路径 renderer。
   */
  readonly source: SchemxDynamicItemDependency<Values, TValues>["renderer"]
  /**
   * 交给普通 Dependency 执行的包装器。
   */
  readonly renderer: SchemxDependencyField<TValues>["renderer"]
  /**
   * 移动时替换行快照，异步输出读取最新位置。
   */
  row: DynamicRowState
}

/**
 * 当前 Dynamic 订阅独占的模板展开器。
 * @typeParam TValues - 完整表单值类型。
 */
export interface DynamicSchemaExpander<TValues extends Values> {
  /**
   * 更新行上下文，展开模板并清理不再使用的 renderer 缓存。
   * @param schema - 当前 Dynamic 容器模板。
   * @param rows - 协调器提供的稳定行结构。
   */
  expand(
    schema: SchemxDynamicField<TValues>,
    rows: readonly DynamicRowState[]
  ): SchemxField<TValues>[]
  /**
   * 释放当前订阅独占的 renderer 缓存。
   */
  dispose(): void
}

/**
 * 创建只负责路径展开和 renderer 包装的行模板展开器。
 * @typeParam TValues - 完整表单值类型。
 * @param store - renderer 执行时读取当前行独立快照的端口。
 * @example const expander = createDynamicSchemaExpander(store)
 * const schemas = expander.expand(schema, rows)
 * expander.dispose()
 */
export function createDynamicSchemaExpander<TValues extends Values>(
  store: Pick<RuntimeStorePort<TValues>, "getFieldSnapshot">
): DynamicSchemaExpander<TValues> {
  // 以完整 Dependency key 区分不同模板节点，包装器随其所属行复用。
  const renderers = new Map<string, CachedRenderer<TValues>>()

  // 当前展开批次保留的包装器；异步生成的嵌套 Dependency 也登记在此集合。
  let activeRendererKeys = new Set<string>()

  /**
   * 将相对模板列表展开到同一行，Group 和 renderer 输出共用此递归入口。
   * @param schemas - 当前层的相对路径模板。
   * @param row - 当前行的身份和位置快照。
   * @param parentKey - 当前模板父级的稳定 key。
   */
  const expandSchemas = (
    schemas: readonly SchemxDynamicItemSchema<Values, TValues>[],
    row: DynamicRowState,
    parentKey: string
  ): SchemxField<TValues>[] => {
    // schema 和 index 为当前模板及其在父级内的位置。
    return schemas.map((schema, index) => {
      // 显式 key 优先，否则沿用模板位置作为标识。
      const templateKey =
        typeof schema.key === "string" && schema.key.length > 0 ? schema.key : index

      // 模板的层级 key 与行路径无关，重排时保持稳定。
      const key = `${parentKey}/${templateKey}`

      if ("item" in schema) {
        throw new Error(
          `[schemx] Dynamic item schema cannot contain nested Dynamic Schema: "${key}".`
        )
      }

      if ("children" in schema && schema.children !== undefined) {
        // 已验证的相对模板在展开后转为完整表单 Schema，泛型路径无法由 TS 推导。
        return {
          ...schema,
          key,
          dependencies: prefixDependencies(schema.dependencies, row.path),
          children: expandSchemas(schema.children, row, key),
        } as SchemxField<TValues>
      }

      if ("renderer" in schema && schema.renderer !== undefined) {
        // Dependency 的 to 和自身 dependencies 保持全表路径，只有输出按行展开。
        const expanded: SchemxDependencyField<TValues> = {
          ...schema,
          key,
          renderer: getRenderer(schema, row, key),
        }

        attachDynamicRow(expanded, row)

        return expanded
      }

      // 字段路径和触发路径均已按同一行展开，保留原模板的回调和扩展属性。
      return {
        ...schema,
        key,
        name: joinDynamicPath(row.path, schema.name),
        dependencies: prefixDependencies(schema.dependencies, row.path),
      } as SchemxField<TValues>
    })
  }

  /**
   * 复用行内 Dependency 包装器，执行和异步返回后都读取当前行位置。
   * @param dependency - 用户声明的行内 Dependency。
   * @param row - 当前行身份和位置。
   * @param key - 展开后的稳定 Dependency key。
   */
  const getRenderer = (
    dependency: SchemxDynamicItemDependency<Values, TValues>,
    row: DynamicRowState,
    key: string
  ): SchemxDependencyField<TValues>["renderer"] => {
    activeRendererKeys.add(key)

    // renderer 源函数不变时复用包装器，避免配置刷新重启异步任务。
    const previous = renderers.get(key)

    if (previous?.source === dependency.renderer) {
      previous.row = row

      return previous.renderer
    }

    // 包装器捕获缓存项本身，只保存一份可替换的行快照。
    const cached: CachedRenderer<TValues> = {
      source: dependency.renderer,
      row,
      // values、form、context 为普通 Dependency 提供的表单值、受保护 API 和取消上下文。
      renderer: async (values, form, context) => {
        // 读取执行时的独立行快照，包含前置字段刚写入的默认值。
        const item = store.getFieldSnapshot(cached.row.path as NamePath<TValues>)

        if (item == null) {
          return []
        }

        // 用户 renderer 只收到公开行上下文，内部元数据不进入业务 Schema。
        const children = await cached.source(values, form, {
          ...context,
          item: item as Values,
          rowKey: String(cached.row.id),
          rowIndex: cached.row.index,
          rowPath: cached.row.path as NamePath<TValues>,
        })

        return expandSchemas(children, cached.row, `${key}/renderer`)
      },
    }

    renderers.set(key, cached)

    return cached.renderer
  }

  /**
   * 按完整行列表展开模板，先更新已有包装器的位置，再生成当前子 Schema。
   * @param schema - 当前 Dynamic 模板。
   * @param rows - 协调后的完整行列表。
   * @example expander.expand(schema, rows)
   */
  const expand: DynamicSchemaExpander<TValues>["expand"] = (schema, rows) => {
    // row 为本次提交的行，id 用于关联缓存包装器。
    const rowsById = new Map(rows.map((row) => [row.id, row]))

    activeRendererKeys = new Set()

    // cached 为已创建的包装器；异步输出在返回时继续使用最新行位置。
    for (const cached of renderers.values()) {
      // 当前包装器所属行的新快照。
      const row = rowsById.get(cached.row.id)

      if (row) {
        cached.row = row
      }
    }

    try {
      // row 为按 Store 顺序排列的稳定行。
      return rows.flatMap((row) =>
        expandSchemas(schema.item, row, `${schema.key}/${row.key}`)
      )
    } finally {
      // key 为本轮模板未再生成的 Dependency 包装器。
      for (const key of renderers.keys()) {
        if (!activeRendererKeys.has(key)) {
          renderers.delete(key)
        }
      }
    }
  }

  /**
   * 随 Dynamic 订阅释放包装器，不提交树或索引。
   * @example expander.dispose()
   */
  const dispose = (): void => {
    renderers.clear()
    activeRendererKeys.clear()
  }

  return { expand, dispose }
}

/**
 * Field 和 Group 的触发路径相对于当前行，其他动态属性原样保留。
 * @param dependencies - 行内 Field 或 Group 的依赖配置。
 * @param rowPath - 当前行的完整路径。
 */
function prefixDependencies(
  dependencies: SchemxContainerDependencies | undefined,
  rowPath: string
): SchemxContainerDependencies | undefined {
  if (!dependencies) {
    return undefined
  }

  return {
    ...dependencies,
    // path 为相对于当前行的触发字段路径。
    triggerFields: dependencies.triggerFields.map((path) =>
      joinDynamicPath(rowPath, path)
    ),
  }
}
