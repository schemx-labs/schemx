/**
 * 公开视图绑定，在 Runtime 投影之外注入完整 Form 实例。
 * @module core/form/schemas
 */

import { batchUpdates } from "../reactivity"
import {
  isViewDynamicSchema,
  isViewGroupSchema,
  subscribeViewSchemas as subscribeRootViewSchemas,
} from "../view"

import type { SchemaCompiler } from "../compiler"
import type { FormConfigModel, ResolvedFormConfig } from "../config/createFormConfig"
import type { SchemxSchemas } from "../createSchemas"
import type { RootNode } from "../node"
import type { Reconciler } from "../reconciler"
import type { SchemxInstance, Values } from "../types"
import type { SchemxViewSchema } from "../view"

/**
 * 每个 Form 独占的视图绑定与缓存。
 * @typeParam TValues - 表单值类型。
 */
interface FormView<TValues extends Values> {
  /**
   * 绑定视图中的字段 Props，相同投影复用相同快照。
   * @param schemas - Runtime 提供的原始投影。
   * @param instance - 当前 Form 的稳定公开实例；同一绑定器始终传入同一实例。
   * @example const schemas = view.bindSchemas(root.viewSchemas?.value ?? [], instance)
   */
  bindSchemas(
    schemas: readonly SchemxViewSchema<TValues>[],
    instance: SchemxInstance<TValues>
  ): readonly SchemxViewSchema<TValues>[]
}

/**
 * 创建一个 Form 独占的视图绑定器，不修改 Runtime 中的投影。
 * @typeParam TValues - 表单值类型。
 * @returns 读取和订阅共用的视图绑定入口。
 * @example const view = createFormView<FormValues>()
 */
function createFormView<TValues extends Values>(): FormView<TValues> {
  // 根列表、Group children 和数组行 children 共用列表缓存。
  const lists = new WeakMap<
    readonly SchemxViewSchema<TValues>[],
    readonly SchemxViewSchema<TValues>[]
  >()

  // 父容器变化时，仍然复用未变化子节点的公开视图。
  const schemasCache = new WeakMap<SchemxViewSchema<TValues>, SchemxViewSchema<TValues>>()

  /**
   * 为列表中的节点绑定同一个公开实例。
   * @param schemas - 当前层的原始视图列表。
   * @param instance - 当前 Form 的公开实例。
   */
  const bindSchemas = (
    schemas: readonly SchemxViewSchema<TValues>[],
    instance: SchemxInstance<TValues>
  ): readonly SchemxViewSchema<TValues>[] => {
    if (schemas.length === 0) {
      return schemas
    }

    // 缓存只依赖原始投影身份，绑定器归当前 Form 独占。
    const cached = lists.get(schemas)

    if (cached) {
      return cached
    }

    // schema 是当前层节点；容器递归绑定，字段只补充 Form 实例。
    const bound = schemas.map((schema) => bindSchema(schema, instance))

    lists.set(schemas, bound)

    return bound
  }

  /**
   * 绑定一个字段或递归绑定容器中的字段。
   * @param schema - Runtime 原始视图节点。
   * @param instance - 当前 Form 的公开实例。
   */
  const bindSchema = (
    schema: SchemxViewSchema<TValues>,
    instance: SchemxInstance<TValues>
  ): SchemxViewSchema<TValues> => {
    // 节点复用跨根列表和容器快照生效。
    const cached = schemasCache.get(schema)

    if (cached) {
      return cached
    }

    // 保持容器结构和数组行身份，仅替换需要绑定的子视图。
    let bound: SchemxViewSchema<TValues>

    if (isViewGroupSchema(schema)) {
      bound = { ...schema, children: bindSchemas(schema.children, instance) }
    } else if (isViewDynamicSchema(schema)) {
      bound = {
        ...schema,
        // item 是当前数组行，保留其身份、key 和位置。
        items: schema.items.map((item) => ({
          ...item,
          children: bindSchemas(item.children, instance),
        })),
      }
    } else {
      bound = {
        ...schema,
        componentProps: { ...schema.componentProps, formInstance: instance },
      }
    }

    schemasCache.set(schema, bound)

    return bound
  }

  return { bindSchemas }
}

/**
 * Schema source、配置提交和公开视图的操作。
 * @typeParam TValues - 表单值类型。
 */
export type FormSchemasApi<TValues extends Values> = Pick<
  SchemxInstance<TValues>,
  | "setSchemas"
  | "updateSchemas"
  | "updateSchemaConfig"
  | "setConfig"
  | "getViewSchemas"
  | "subscribeViewSchemas"
>

/**
 * Schema 域依赖与实例身份延迟读取入口。
 * @typeParam TValues - 表单值类型。
 */
export interface CreateFormSchemasOptions<TValues extends Values> {
  /**
   * 根视图及统一表单级终态。
   */
  readonly root: RootNode<TValues>
  /**
   * 配置提交使用的编译能力。
   */
  readonly compiler: Pick<SchemaCompiler<TValues>, "setConfig">
  /**
   * 配置提交使用的节点刷新能力。
   */
  readonly reconciler: Pick<Reconciler<TValues>, "refresh">
  /**
   * Form 归一化的 Schema source。
   */
  readonly schemas: SchemxSchemas<TValues>
  /**
   * 固定继承层和当前生效配置的模型。
   */
  readonly configuration: FormConfigModel<TValues>
  /**
   * 视图读取时获取完整、稳定的 Form 实例。
   */
  readonly getInstance: () => SchemxInstance<TValues>
}

/**
 * Schema 域的公开投影。
 * @typeParam TValues - 表单值类型。
 */
export interface FormSchemas<TValues extends Values> {
  /**
   * source 更新、配置提交及视图订阅。
   */
  readonly api: FormSchemasApi<TValues>
}

/**
 * 保持同一 Schema source 及视图缓存，不拥有其生命周期。
 * @typeParam TValues - 表单值类型。
 * @param options - source、配置模型、根视图与配置刷新模块。
 * @example const schemas = createFormSchemas({ root, compiler, reconciler, schemas: source, configuration, getInstance })
 */
export function createFormSchemas<TValues extends Values>(
  options: CreateFormSchemasOptions<TValues>
): FormSchemas<TValues> {
  // 延迟读取实例，避免创建域时形成循环依赖。
  const { root, compiler, reconciler, configuration, getInstance } = options

  // source 归一化由 Form 完成，域只转发其更新。
  const schemaSource = options.schemas

  // 视图投影缓存由当前 Form 独占。
  const view = createFormView<TValues>()

  /**
   * 在配置模型发布新状态前刷新节点，失败时恢复 Compiler 的旧配置。
   * @param next - 模型生成的完整候选配置。
   */
  const applyConfig = (next: ResolvedFormConfig<TValues>): void => {
    if (root.disposed.value) {
      return
    }

    batchUpdates(() => {
      // 模型尚未发布候选状态，此处仍能读取已提交配置。
      const previous = configuration.getConfig()

      compiler.setConfig(next)
      try {
        reconciler.refresh()
      } catch (error) {
        compiler.setConfig(previous)
        throw error
      }
    })
  }

  // Schema source 的生命周期由 Form 持有，销毁后拒绝更新。
  const setSchemas: SchemxInstance<TValues>["setSchemas"] = (schemas) => {
    if (!root.disposed.value) {
      schemaSource.set(schemas)
    }
  }

  // 委托基于当前 Schema 更新下一版 Schema。
  const updateSchemas: SchemxInstance<TValues>["updateSchemas"] = (updater) => {
    if (!root.disposed.value) {
      schemaSource.update(updater)
    }
  }

  // 委托更新表单级 Schema 默认配置。
  const updateSchemaConfig: SchemxInstance<TValues>["updateSchemaConfig"] = (partial) => {
    if (!root.disposed.value) {
      configuration.updateSchemaConfig(partial, applyConfig)
    }
  }

  // 只替换消费配置，固定库默认值不受更新影响。
  const setConfig: SchemxInstance<TValues>["setConfig"] = (config) => {
    if (!root.disposed.value) {
      configuration.setConfig(config, applyConfig)
    }
  }

  // 读取当前已解析的视图 Schema；Form 销毁后返回空数组。
  const getViewSchemas: SchemxInstance<TValues>["getViewSchemas"] = () =>
    view.bindSchemas(
      root.disposed.value ? [] : (root.viewSchemas?.value ?? []),
      getInstance()
    )

  // 订阅视图 Schema 变化；Form 销毁后返回空清理函数。
  const subscribeViewSchemas: SchemxInstance<TValues>["subscribeViewSchemas"] = (
    callback
  ) => {
    if (root.disposed.value) {
      return () => {}
    }

    // schemas 是 Runtime 原始投影，订阅与同步读取共用绑定缓存。
    return subscribeRootViewSchemas(root, (schemas) =>
      callback(view.bindSchemas(schemas, getInstance()))
    )
  }

  // 对外只提供 source、配置和视图操作。
  const api: FormSchemasApi<TValues> = {
    setSchemas,
    updateSchemas,
    updateSchemaConfig,
    setConfig,
    getViewSchemas,
    subscribeViewSchemas,
  }

  return { api }
}
