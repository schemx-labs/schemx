/**
 * SchemaRuntime 的创建与生命周期管理。
 *
 * 将 Schema source、Node tree、资源生命周期、视图投影和 Scheduler 组合为一个
 * 可挂载、更新、订阅和销毁的运行时实例。
 *
 * @module core/runtime/createSchemaRuntime
 */

import { createFormApi } from "../form"
import { batchUpdates } from "../reactivity"

import { createSchemaCompiler } from "./compiler"
import { createNodeLifecycleEmitter } from "./lifecycle"
import {
  createNodeLifecycle,
  createNodeManager,
  createScope,
  findFieldNode,
} from "./node"
import { createScheduler } from "./scheduler"
import { attachRootViewSchemas, subscribeViewSchemas } from "./view"

import { createReconciler } from "./index"

import type {
  ContainerNode,
  NodeId,
  ResolvedFieldSchema,
  RootNode,
  SchemaNode,
} from "./node"
import type { SchemxSchemas } from "../createSchemas"
import type { SchemaCompiler } from "./compiler"
import type {
  Reconciler,
  RuntimeStorePort,
  RuntimeValidationPort,
  SchemaRuntimeContext,
} from "./index"
import type { NodeLifecycleHooks } from "./lifecycle"
import type { SchedulerOptions } from "./scheduler"
import type { SchemxViewSchema } from "./view"
import type {
  NamePath,
  SchemxBaseField,
  SchemxField,
  SchemxFieldRulesMap,
  SchemxInstance,
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
   * 创建边界已合并并补齐 Core 默认值的字段默认配置。
   * Runtime 复制配置外层，嵌套属性保留引用，随后与 Compiler 共享实例内的副本。
   */
  schemaConfig: SchemxSchemaConfig<TValues>
  /**
   * 按字段路径配置的表单级校验规则。
   */
  fieldRules?: SchemxFieldRulesMap<TValues>
  /**
   * 按 Renderer 类型配置的静态默认 Props。
   */
  rendererProps?: SchemxRendererPropsMap<TValues>
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
 * Core 配置模型解析完成的编译输入。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export interface SchemaRuntimeConfig<TValues extends Values> {
  /**
   * 已补齐 Core 默认值的 Schema 配置。
   */
  readonly schemaConfig: Readonly<SchemxSchemaConfig<TValues>>
  /**
   * 当前 Renderer 默认 Props；省略时撤销此前配置。
   */
  readonly rendererProps?: SchemxRendererPropsMap<TValues>
}

/**
 * 挂载后持有的编译与协调资源；销毁时释放对 Form 的引用。
 * @typeParam TValues - 表单值对象类型。
 */
interface MountedSchemaRuntime<TValues extends Values> {
  readonly compiler: SchemaCompiler<TValues>
  readonly reconciler: Reconciler<TValues>
}

/**
 * 管理 Schema 的编译、挂载、增量更新、视图订阅与销毁。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface SchemaRuntime<TValues extends Values> {
  /**
   * 检查 Runtime 是否已经开始销毁。
   */
  isDisposed(): boolean
  /**
   * Runtime 根节点。
   */
  readonly root: RootNode<TValues>
  /**
   * 按 Form 内唯一的节点 ID 获取运行时节点。
   *
   * @param nodeId - 要查询的节点 ID。
   * @returns 匹配的 Schema 节点；节点不存在或为透明 root 时返回 `undefined`。
   */
  getNode(nodeId: NodeId): SchemaNode<TValues> | undefined
  /**
   * 获取当前生效的字段默认配置快照。
   *
   * @returns 当前 Runtime 使用的 schemaConfig。
   */
  getSchemaConfig(): Readonly<SchemxSchemaConfig<TValues>>
  /**
   * 挂载 Schema source 并订阅后续变更；同一 Runtime 只能挂载一次。
   * @param instance - 完整的 Form 实例；动态回调 API 在挂载时统一选择。
   * @throws Runtime 已挂载时抛出错误。
   */
  mount(instance: SchemxInstance<TValues>): void
  /**
   * 完整应用已解析配置并刷新一次节点，不解释继承来源或合并规则。
   * @param config - Core 提交的完整编译结果。
   */
  setConfig(this: void, config: SchemaRuntimeConfig<TValues>): void
  /**
   * 获取字段用于交互和校验的生效配置。
   *
   * @param name - 要查询的字段路径。
   * @returns 字段规则上下文；字段不存在时返回 `undefined`。
   */
  getFieldRuleContext(name: NamePath<TValues>): ResolvedFieldSchema<TValues> | undefined
  /**
   * @deprecated 请改用 {@link SchemaRuntime.getFieldRuleContext}。
   */
  getEffectiveFieldSchema(
    name: NamePath<TValues>
  ):
    | Pick<
        SchemxBaseField<TValues>,
        "label" | "placeholder" | "required" | "visible" | "readonly" | "disabled"
      >
    | undefined
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
  dispose(this: void): void
}

/**
 * 创建一个独立的 SchemaRuntime。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Runtime 所需的 Store、Validator、Schema source 和默认配置。
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
 *   schemaConfig,
 * })
 * runtime.mount(instance)
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
  const schemaConfig = { ...options.schemaConfig }

  // Compiler 复用外层容器，消费配置撤销后可以删除旧 Props。
  const rendererProps: SchemxRendererPropsMap<TValues> = { ...options.rendererProps }

  // 标记 Runtime 是否已经释放。
  let disposed = false

  // 标记初始 Schema 是否已经挂载。
  let mounted = false

  // 挂载前没有编译资源；销毁后清空，释放其捕获的 Instance 和 Form API。
  let session: MountedSchemaRuntime<TValues> | undefined

  const nodeManager = createNodeManager<TValues>()

  // Runtime 根节点及其视图状态。
  const root = nodeManager.getRoot()

  attachRootViewSchemas(root)

  // 公开实例使用稳定的 Runtime 引用，通过生命周期状态拒绝销毁后的操作。
  const isDisposed = (): boolean => disposed

  /**
   * 将最新 Schema 提交给根节点协调。
   *
   * @param nextSchemas - 最新的根 Schema 列表。
   */
  const applySchemas = (nextSchemas: readonly SchemxField<TValues>[]): void => {
    if (disposed) {
      return
    }

    session?.reconciler.reconcile(nextSchemas)
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
    session?.reconciler.clear()
    nodeManager.dispose()
    root.disposed.value = true
    root.scope.dispose()
    scheduler.dispose()
    session = undefined
  }

  /**
   * 挂载 Schema source 并注册其变更订阅。
   * @param instance - 已完成组装的 Form 实例；动态回调 API 在挂载边界统一选择。
   */
  const mount = (instance: SchemxInstance<TValues>): void => {
    if (mounted) {
      throw new Error("[schemx] Schema runtime is already mounted.")
    }

    if (disposed) {
      return
    }

    mounted = true

    try {
      // 全部挂载依赖就绪后，才允许首次协调执行用户代码。
      const compiler = createSchemaCompiler<TValues>({
        schemaConfig,
        rendererProps,
        formInstance: instance,
        debug: options.debug,
      })

      const context: SchemaRuntimeContext<TValues> = {
        debug: options.debug ?? false,
        fieldRules: options.fieldRules ?? {},
        store: options.store,
        formApi: createFormApi(instance),
        validation: options.validation,
        scheduler,
        lifecycle,
      }

      const runtimeNodeLifecycle = createNodeLifecycle(context)

      const reconciler = createReconciler<TValues>({
        compiler,
        nodeManager,
        lifecycle: runtimeNodeLifecycle,
      })

      session = { compiler, reconciler }
      applySchemas(options.schemas.peek())
      scope.add(options.schemas.subscribe(applySchemas))
    } catch (error) {
      dispose()
      throw error
    }
  }

  /**
   * 按 Form 内唯一的节点 ID 读取运行时节点。
   */
  const getNode = (nodeId: NodeId): SchemaNode<TValues> | undefined => {
    const node = nodeManager.get(nodeId)

    return node && node.type !== "root" ? node : undefined
  }

  /**
   * 读取当前生效的字段默认配置。
   */
  const getSchemaConfig = (): Readonly<SchemxSchemaConfig<TValues>> => {
    return schemaConfig
  }

  /**
   * 应用同一配置模型提交的结果，同时清理撤销的 Schema 扩展与 Renderer Props。
   * @param config - 完整的 Schema 默认值与 Renderer 默认 Props。
   */
  const setConfig = (config: SchemaRuntimeConfig<TValues>): void => {
    if (disposed) {
      return
    }

    batchUpdates(() => {
      for (const key of Object.keys(schemaConfig)) {
        if (!Object.hasOwn(config.schemaConfig, key)) {
          Reflect.deleteProperty(schemaConfig, key)
        }
      }

      Object.assign(schemaConfig, config.schemaConfig)
      for (const key of Object.keys(rendererProps)) {
        if (!Object.hasOwn(config.rendererProps ?? {}, key)) {
          Reflect.deleteProperty(rendererProps, key)
        }
      }

      Object.assign(rendererProps, config.rendererProps)
      session?.compiler.invalidateConfigCache()
      session?.reconciler.refresh()
    })
  }

  /**
   * 读取字段用于交互和校验的生效配置。
   */
  const getFieldRuleContext = (
    name: NamePath<TValues>
  ): ResolvedFieldSchema<TValues> | undefined => {
    return disposed ? undefined : findFieldNode(root, name)?.resolvedSchema.value
  }

  /**
   * 读取根节点维护的视图 Schema 投影。
   */
  const getViewSchemas = (): readonly SchemxViewSchema<TValues>[] => {
    return disposed ? [] : (root.viewSchemas?.value ?? [])
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

  return {
    isDisposed,
    root,
    getNode,
    getSchemaConfig,
    mount,
    setConfig,
    getFieldRuleContext,
    getEffectiveFieldSchema: getFieldRuleContext,
    getViewSchemas,
    subscribeViewSchemas: subscribeRuntimeViewSchemas,
    waitForIdle,
    waitForCriticalIdle,
    dispose,
  }
}
