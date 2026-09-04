/**
 * SchemaRuntime 的创建与生命周期管理。
 *
 * 将 Schema source、Node tree、资源生命周期、视图投影和 Scheduler 组合为一个
 * 可挂载、更新、订阅和销毁的运行时实例。
 *
 * @module core/runtime/createSchemaRuntime
 */

import { defaultSchemxConfigKeys, mergeAndResolveSchemxConfig } from "../config"
import { normalizeSchemas } from "../utils"

import { createCompile } from "./compiler"
import { createNodeLifecycleEmitter } from "./lifecycle"
import { createNodeLifecycle, createScope } from "./node"
import { findFieldNode } from "./node/helper"
import { createNodeManager } from "./node/nodeManager"
import { createReconciler } from "./reconciler"
import { createScheduler } from "./scheduler"
import { subscribeViewSchemas } from "./view"
import { createRootRuntimeViewSchemas } from "./view/createViewSchemas"

import type { ContainerNode, RootNode } from "./node"
import type { SchemxSchemas } from "../createSchemas"
import type {
  RuntimeStorePort,
  RuntimeValidationPort,
  SchemaRuntimeContext,
} from "./context"
import type { NodeLifecycleHooks } from "./lifecycle"
import type { SchedulerOptions } from "./scheduler"
import type { SchemxViewSchema } from "./view"
import type {
  NamePath,
  SchemxBaseField,
  SchemxField,
  SchemxFieldRulesMap,
  SchemxFormApi,
  SchemxInstance,
  SchemxRendererKey,
  SchemxRendererPropsMap,
  SchemxSchemaConfig,
  Values,
} from "../types"

/**
 * 创建 SchemaRuntime 所需的依赖。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface CreateSchemaRuntimeOptions<TValues extends Values> {
  /**
   * Runtime 订阅并协调的根 Schema source。
   */
  schemas: SchemxSchemas<TValues>
  /**
   * Runtime 访问字段状态和初始值的最小 Store Port。
   */
  store: RuntimeStorePort<TValues>
  /**
   * Runtime 管理字段校验的最小 Validator Port。
   */
  validation: RuntimeValidationPort<TValues>
  /**
   * 对外暴露且在 descriptor/renderer 中共享的 Form 实例。
   */
  instance: SchemxInstance<TValues>
  /**
   * 传递给动态 renderer 的轻量 Form API。
   */
  formApi: SchemxFormApi<TValues>
  /**
   * 已合并的字段默认配置。
   */
  schemaConfig: SchemxSchemaConfig
  /**
   * 按字段路径配置的表单级校验规则。
   */
  fieldRules?: SchemxFieldRulesMap<TValues>
  /**
   * 按 Renderer 类型配置的静态默认 Props。
   */
  rendererProps?: SchemxRendererPropsMap<TValues>
  /**
   * 未注册 renderer 的 fallback 类型。
   */
  defaultRendererType?: SchemxRendererKey<TValues>
  /**
   * Runtime 生命周期钩子。
   */
  lifecycleHooks?: NodeLifecycleHooks<ContainerNode<TValues>>
  /**
   * 是否启用 Runtime diagnostics。
   */
  debug?: boolean
  /**
   * Scheduler 时间片与 idle 任务配置。
   */
  schedulerOptions?: SchedulerOptions
}

/**
 * 管理 Schema 的编译、挂载、增量更新、视图订阅与销毁。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface SchemaRuntime<TValues extends Values> {
  /**
   * Runtime 根节点。
   */
  readonly root: RootNode<TValues>
  /**
   * 挂载 Schema source 并订阅后续变更；同一 Runtime 只能挂载一次。
   * @throws Runtime 已挂载时抛出错误。
   */
  mount(): void
  /**
   * 更新字段默认属性并重新编译当前 Schema。
   *
   * @param partial - 要覆盖的默认属性。
   */
  updateSchemaConfig(partial: Partial<SchemxSchemaConfig>): void
  /**
   * 获取字段当前生效的 label 与 required 配置。
   *
   * @param name - 要查询的字段路径。
   * @returns 字段已编译时的有效配置；字段不存在时返回 `undefined`。
   */
  getEffectiveFieldSchema(
    name: NamePath<TValues>
  ): Pick<SchemxBaseField<TValues>, "label" | "required"> | undefined
  /**
   * 获取当前视图 Schema 快照。
   *
   * @returns 当前根节点投影出的只读视图 Schema。
   */
  getViewSchemas(): readonly SchemxViewSchema<TValues>[]
  /**
   * 订阅视图 Schema 变化，并返回取消订阅函数。
   *
   * @param callback - 每次视图 Schema 更新时调用的回调。
   * @returns 取消当前订阅的函数。
   */
  subscribeViewSchemas(
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ): () => void
  /**
   * 等待 Runtime 当前所有调度任务进入空闲状态，包括 dependency effect 和 idle 任务。
   *
   * @param timeout - 最大等待时间（毫秒），默认 `10000`。
   * @returns 在超时前进入空闲状态时返回 `true`。
   */
  waitForIdle(timeout?: number): Promise<boolean>
  /**
   * 仅等待 normal/post 任务及其异步工作完成，不等待 idle 后台任务。
   *
   * @param timeout - 最大等待时间（毫秒），默认 `10000`。
   * @returns 在超时前进入关键空闲状态时返回 `true`。
   */
  waitForCriticalIdle(timeout?: number): Promise<boolean>
  /**
   * 幂等释放 Runtime 的节点、调度器和订阅资源。
   */
  dispose(): void
}

/**
 * 创建一个独立的 SchemaRuntime。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Runtime 所需的 Store、Validator、实例、API 和默认配置。
 * @returns 可挂载和更新 Schema 的 Runtime。
 *
 * @remarks
 * Runtime 直接依赖 Store 与 Validator 的最小能力集合。
 *
 * @example
 * ```ts
 * const runtime = createSchemaRuntime({
 *   schemas,
 *   store,
 *   validation,
 *   instance,
 *   formApi,
 *   schemaConfig,
 * })
 * runtime.mount()
 * ```
 */
export function createSchemaRuntime<TValues extends Values>(
  options: CreateSchemaRuntimeOptions<TValues>
): SchemaRuntime<TValues> {
  // 管理 Runtime 内部订阅、调度任务和销毁顺序。
  const scope = createScope()

  // 执行 dependency 与 post 阶段任务。
  const scheduler = createScheduler({
    ...options.schedulerOptions,
    collectDiagnostics:
      options.schedulerOptions?.collectDiagnostics ?? options.debug === true,
  })

  // 广播 Runtime 生命周期事件。
  const lifecycle = createNodeLifecycleEmitter<ContainerNode<TValues>>(
    options.lifecycleHooks
  )

  // Runtime 与 Compiler 共享同一份配置引用，动态更新后无需重新装配 Compiler。
  const { schemaConfig } = mergeAndResolveSchemxConfig({
    schemaConfig: options.schemaConfig,
  })

  // 编译 Schema 并保留当前 Form 实例引用。
  const compile = createCompile({
    schemaConfig,
    rendererProps: options.rendererProps,
    defaultRendererType: options.defaultRendererType,
    formInstance: options.instance,
    debug: options.debug,
  })

  // 标记 Runtime 是否已经释放。
  let disposed = false

  // 标记初始 Schema 是否已经挂载。
  let mounted = false

  // Runtime 内部共享的最小服务上下文。
  const context: SchemaRuntimeContext<TValues> = {
    debug: options.debug ?? false,
    schemaConfig,
    instance: options.instance,
    fieldRules: options.fieldRules ?? {},
    store: options.store,
    formApi: options.formApi,
    validation: options.validation,
    scheduler,
    lifecycle,
    // 统一由 Reconciler 提交子 Schema，避免各调用方绕过树提交流程。
    reconcileChildren: (parentId, schemas) =>
      reconciler.reconcileChildren(
        parentId,
        normalizeSchemas(schemas, options.defaultRendererType)
      ),
  }

  const nodeManager = createNodeManager<TValues>()

  // Runtime 根节点及其视图状态。
  const root = nodeManager.getRoot()

  const runtimeNodeLifecycle = createNodeLifecycle(context)

  const reconciler = createReconciler<TValues>({
    compiler: compile,
    nodeManager,
    lifecycle: runtimeNodeLifecycle,
  })

  createRootRuntimeViewSchemas(root)

  /**
   * 将最新 Schema 提交给根节点协调。
   *
   * @param nextSchemas - 最新的根 Schema 列表。
   */
  const applySchemas = (nextSchemas: readonly SchemxField<TValues>[]): void => {
    if (disposed) {
      return
    }

    reconciler.reconcile(normalizeSchemas(nextSchemas, options.defaultRendererType))
  }

  /**
   * 挂载 Schema source 并注册其变更订阅。
   */
  const mount = (): void => {
    if (mounted) {
      throw new Error("[schemx] Schema runtime is already mounted.")
    }

    if (disposed) {
      return
    }

    mounted = true

    applySchemas(options.schemas.peek())
    scope.add(options.schemas.subscribe(applySchemas))
  }

  /**
   * 合并新的默认属性并使编译缓存失效。
   */
  const updateSchemaConfig = (partial: Partial<SchemxSchemaConfig>): void => {
    if (disposed) {
      return
    }

    const schemaConfigPatch = Object.fromEntries(
      defaultSchemxConfigKeys
        .filter((key) => Object.prototype.hasOwnProperty.call(partial, key))
        .map((key) => [key, partial[key]])
    ) as Partial<SchemxSchemaConfig>

    Object.assign(
      context.schemaConfig,
      mergeAndResolveSchemxConfig(
        { schemaConfig: schemaConfigPatch },
        { schemaConfig: context.schemaConfig }
      ).schemaConfig
    )

    compile.invalidate()
    applySchemas(options.schemas.peek())
  }

  /**
   * 读取字段当前的动态生效配置。
   */
  const getEffectiveFieldSchema = (
    name: NamePath<TValues>
  ): Pick<SchemxBaseField<TValues>, "label" | "required"> | undefined => {
    return findFieldNode(root, name)?.effectiveSchema.value
  }

  /**
   * 读取根节点维护的视图 Schema 投影。
   */
  const getViewSchemas = (): readonly SchemxViewSchema<TValues>[] => {
    return root.viewSchemas?.value ?? []
  }

  /**
   * 订阅根节点视图 Schema 的变化。
   *
   * @param callback - 视图 Schema 更新时调用的回调。
   * @returns 取消订阅函数。
   */
  const subscribeRuntimeViewSchemas = (
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ): (() => void) => {
    return subscribeViewSchemas(root, callback)
  }

  /**
   * 等待调度器及 dependency effect 完成当前批次。
   *
   * @param timeout - 最大等待时间（毫秒）。
   * @returns 在超时前进入空闲状态时返回 `true`。
   */
  const waitForIdle = (timeout = 10000): Promise<boolean> => {
    return scheduler.whenIdle(timeout)
  }

  /**
   * 提交与校验使用的关键空闲边界，不被后台 idle 任务阻塞。
   *
   * @param timeout - 最大等待时间（毫秒）。
   * @returns 在超时前进入关键空闲状态时返回 `true`。
   */
  const waitForCriticalIdle = (timeout = 10000): Promise<boolean> => {
    return scheduler.whenIdle({ timeout, includeIdle: false })
  }

  /**
   * 幂等释放 Runtime 持有的节点、调度和订阅资源。
   */
  const dispose = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    scope.dispose()
    reconciler.clear()
    nodeManager.dispose()
    runtimeNodeLifecycle.dispose(root)
    scheduler.dispose()
  }

  return {
    root,
    mount,
    updateSchemaConfig,
    getEffectiveFieldSchema,
    getViewSchemas,
    subscribeViewSchemas: subscribeRuntimeViewSchemas,
    waitForIdle,
    waitForCriticalIdle,
    dispose,
  }
}
