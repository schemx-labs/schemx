/**
 * Schema source、配置提交及单次视图投影的公开入口。
 * @module core/form/schemas
 */

import { batchUpdates } from "../reactivity"
import { reportCleanupError } from "../scope"

import type { FormConfigModel, ResolvedFormConfig } from "../config/createFormConfig"
import type { SchemxSchemas } from "../createSchemas"
import type { ReadonlySignal } from "../reactivity"
import type { SchemaRuntimeTree } from "../runtime"
import type { SchemxField, SchemxInstance, Values } from "../types"

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
   * 表单级销毁状态。
   */
  readonly disposed: ReadonlySignal<boolean>
  /** 根提交和配置刷新由同一个 Runtime 提供。 */
  readonly tree: SchemaRuntimeTree<TValues>
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
  /** 订阅 source 并提交初始 Schema。 */
  readonly mount: () => void
  /** 停止接收 Schema 并解除订阅。 */
  readonly dispose: () => void
}

/**
 * 协调单个表单的 Schema source 订阅、成功版本和节点视图。
 * @typeParam TValues - 表单值类型。
 * @param options - source、配置模型、根视图与配置刷新模块。
 * @example
 * const schemas = createFormSchemas({ disposed, tree, schemas: source, configuration })
 * schemas.mount()
 */
export function createFormSchemas<TValues extends Values>(
  options: CreateFormSchemasOptions<TValues>
): FormSchemas<TValues> {
  // 当前 Form 持有的 source、配置和协调资源。
  const { disposed: runtimeDisposed, tree, configuration } = options

  // 归一化后的 source 可以由多个表单共享。
  const schemaSource = options.schemas

  // 最近一次成功提交的完整根 Schema。
  let committed: readonly SchemxField<TValues>[] = []

  // 最近被本表单拒绝的 source 输入。
  let rejected: readonly SchemxField<TValues>[] | undefined

  // 当前协调期间收到的最后一次替换。
  let pending: readonly SchemxField<TValues>[] | undefined

  // 提交期间只收集候选，避免同步钩子重入 Reconciler。
  let applying = false

  // 当前 source 订阅的清理入口。
  let unsubscribe: (() => void) | undefined

  // 域级终态也覆盖订阅尚未返回的情况。
  let disposed = false

  /**
   * 串行提交完整候选，失败时保留本表单的成功版本。
   * @param schemas - source 发布的新根 Schema。
   * @param duringMount - 首次挂载时读取批次内尚未通知的信号值。
   */
  const applySchemas = (
    schemas: readonly SchemxField<TValues>[],
    duringMount = false
  ): void => {
    if (disposed || runtimeDisposed.peek()) {
      return
    }

    pending = schemas
    if (applying) {
      return
    }

    // 仍需处理钩子发布的后续候选，并将首个错误交还给调用方。
    let failure: { error: unknown } | undefined

    applying = true
    try {
      while (pending && !disposed && !runtimeDisposed.peek()) {
        // 本次协调独占的候选；钩子可以提交下一份。
        const candidate: readonly SchemxField<TValues>[] = pending

        pending = undefined

        if (candidate === committed) {
          rejected = undefined
          continue
        }

        // 首次挂载可能位于外层 batch 中，在其结束前主动检查 source 的信号。
        const previousInput = duringMount ? schemaSource.signal?.peek() : undefined

        try {
          tree.reconcile(candidate)
          committed = candidate
          rejected = undefined
        } catch (error) {
          rejected = candidate
          failure ??= { error }
        }

        // 批次内的挂载钩子可以先写入 source，订阅回调稍后才会执行。
        const latest = duringMount ? schemaSource.signal?.peek() : undefined

        if (latest && latest !== previousInput) {
          pending = latest
        }
      }
    } finally {
      pending = undefined
      applying = false
    }

    if (failure) {
      throw failure.error
    }
  }

  /** 建立订阅后提交当前 source，覆盖首次挂载钩子产生的同步更新。 */
  const mount = (): void => {
    if (disposed || unsubscribe) {
      return
    }

    // 兼容订阅建立时立即通知的 source；订阅完成后统一读取实际初值。
    const stop = schemaSource.subscribe((schemas) => {
      // schemas 为本次发布的完整列表。
      if (unsubscribe) {
        applySchemas(schemas)
      }
    })

    if (disposed || runtimeDisposed.peek()) {
      try {
        stop()
      } catch (error) {
        reportCleanupError(error)
      }

      return
    }

    unsubscribe = stop
    applySchemas(schemaSource.peek(), true)
  }

  /** 先关闭提交入口，再释放已建立的订阅。 */
  const dispose = (): void => {
    disposed = true
    pending = undefined

    // 先移除引用，以便取消函数重入时仍保持幂等。
    const stop = unsubscribe

    unsubscribe = undefined
    stop?.()
  }

  /**
   * 在配置模型发布新状态前刷新节点，失败时恢复 Compiler 的旧配置。
   * @param next - 模型生成的完整候选配置。
   */
  const applyConfig = (next: ResolvedFormConfig<TValues>): void => {
    if (runtimeDisposed.value) {
      return
    }

    batchUpdates(() => {
      // 模型尚未发布候选状态，此处仍能读取已提交配置。
      tree.refreshConfig(next, configuration.getConfig())
    })
  }

  // 替换 source，供共享该 source 的表单各自提交。
  const setSchemas: SchemxInstance<TValues>["setSchemas"] = (schemas) => {
    if (!runtimeDisposed.value) {
      schemaSource.set(schemas)
    }
  }

  // 未提交的同批候选仍可派生；已拒绝的输入回退到成功版本。
  const updateSchemas: SchemxInstance<TValues>["updateSchemas"] = (updater) => {
    if (!runtimeDisposed.value) {
      // current 为 source 的最新输入，包括批次内尚未发布的版本。
      schemaSource.update((current) =>
        updater(current === rejected ? committed : current)
      )
    }
  }

  // 委托更新表单级 Schema 默认配置。
  const updateSchemaConfig: SchemxInstance<TValues>["updateSchemaConfig"] = (partial) => {
    if (!runtimeDisposed.value) {
      configuration.updateSchemaConfig(partial, applyConfig)
    }
  }

  // 只替换消费配置，固定库默认值不受更新影响。
  const setConfig: SchemxInstance<TValues>["setConfig"] = (config) => {
    if (!runtimeDisposed.value) {
      configuration.setConfig(config, applyConfig)
    }
  }

  // 对外只提供 source、配置和视图操作。
  const api: FormSchemasApi<TValues> = {
    setSchemas,
    updateSchemas,
    updateSchemaConfig,
    setConfig,
    getViewSchemas: tree.getViewSchemas,
    subscribeViewSchemas: tree.subscribeViewSchemas,
  }

  return { api, mount, dispose }
}
