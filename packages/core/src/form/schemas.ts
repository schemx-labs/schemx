/**
 * Schema source、配置提交及单次视图投影的公开入口。
 * @module core/form/schemas
 */

import { batchUpdates } from "../reactivity"
import { subscribeViewSchemas as subscribeRootViewSchemas } from "../view"

import type { SchemaCompiler } from "../compiler"
import type { FormConfigModel, ResolvedFormConfig } from "../config/createFormConfig"
import type { SchemxSchemas } from "../createSchemas"
import type { RootNode } from "../node"
import type { Reconciler } from "../reconciler"
import type { SchemxInstance, Values } from "../types"

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
 * Schema 域使用的配置与协调能力。
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
 * 复用同一 Schema source 及节点视图，不拥有其生命周期。
 * @typeParam TValues - 表单值类型。
 * @param options - source、配置模型、根视图与配置刷新模块。
 * @example const schemas = createFormSchemas({ root, compiler, reconciler, schemas: source, configuration })
 */
export function createFormSchemas<TValues extends Values>(
  options: CreateFormSchemasOptions<TValues>
): FormSchemas<TValues> {
  // 当前 Form 持有的 source、配置和协调资源。
  const { root, compiler, reconciler, configuration } = options

  // source 归一化由 Form 完成，域只转发其更新。
  const schemaSource = options.schemas

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
    root.disposed.value ? [] : (root.viewSchemas?.value ?? [])

  // 订阅视图 Schema 变化；Form 销毁后返回空清理函数。
  const subscribeViewSchemas: SchemxInstance<TValues>["subscribeViewSchemas"] = (
    callback
  ) => {
    if (root.disposed.value) {
      return () => {}
    }

    // 订阅和同步读取共用节点的最终投影。
    return subscribeRootViewSchemas(root, callback)
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
