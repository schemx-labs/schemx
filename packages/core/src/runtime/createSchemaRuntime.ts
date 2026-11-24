/**
 * 单个表单的 Schema Runtime 装配与释放。
 * @module core/runtime/createSchemaRuntime
 */

import { createScheduler } from "../scheduler"
import { createScope } from "../scope"

import { createSchemaCompiler } from "./compiler"
import { createRuntimeFieldAccess } from "./field/access"
import { createNodeManager } from "./node"
import { createRuntimeNodeFactory } from "./node/factory"
import { createReconciler } from "./reconciler"
import { subscribeViewSchemas as subscribeRootViewSchemas } from "./view/subscribeViewSchemas"
import { attachRootViewSchemas } from "./view/viewProjection"

import type { ResolvedFormConfig } from "../config/createFormConfig"
import type { ReadonlySignal } from "../reactivity"
import type { FormRuntimeContext } from "./context"
import type { SchemxInstance, Values } from "../types"
import type { RuntimeFieldAccess } from "./field/access"
import type { NodeLifecycleHooks } from "./node/snapshot"
import type { Reconciler } from "./reconciler"

/** runtime 装配时固定的配置和生命周期钩子。 */
interface SchemaRuntimeOptions<TValues extends Values> {
  /** 当前表单已解析的初始配置。 */
  readonly config: ResolvedFormConfig<TValues>
  /** 节点提交阶段通知的业务钩子。 */
  readonly lifecycleHooks?: NodeLifecycleHooks<TValues>
}

/** 连接业务端口后可执行的根 Schema 操作。 */
export interface SchemaRuntimeTree<TValues extends Values> extends Pick<
  SchemxInstance<TValues>,
  "getViewSchemas" | "subscribeViewSchemas"
> {
  /** 提交一版完整根 Schema。 */
  readonly reconcile: Reconciler<TValues>["reconcile"]
  /**
   * 应用候选配置并刷新已挂载节点；失败时恢复编译配置。
   * @param next - 尚未发布的配置。
   * @param previous - 上一次成功发布的配置。
   */
  readonly refreshConfig: (
    next: ResolvedFormConfig<TValues>,
    previous: ResolvedFormConfig<TValues>
  ) => void
}

/** 表单提供给 runtime 的业务端口。 */
type SchemaRuntimePorts<TValues extends Values> = Omit<
  FormRuntimeContext<TValues>,
  "debug" | "nodeManager" | "scheduler"
>

/** 表单装配期间持有的 runtime 能力。 */
interface SchemaRuntime<TValues extends Values> {
  /** 供表单域和 adapter 读取的唯一销毁信号。 */
  readonly disposed: ReadonlySignal<boolean>
  /** 供规则、校验与字典使用的字段查询接口。 */
  readonly fields: RuntimeFieldAccess<TValues>
  /** 与公开表单实例共享的依赖等待入口。 */
  readonly waitForDependencies: SchemxInstance<TValues>["waitForDependencies"]
  /**
   * 连接表单业务端口，准备根视图和节点协调。
   * @param ports - 已完成装配的表单服务。
   */
  readonly connect: (ports: SchemaRuntimePorts<TValues>) => SchemaRuntimeTree<TValues>
  /** 发布终态，让表单先停掉外部 source 再卸载节点。 */
  readonly markDisposed: () => void
  /** 按逆序释放 runtime 已创建的资源。 */
  readonly dispose: () => void
}

/**
 * 建立节点索引与调度器，业务端口就绪后再连接 compiler 和 reconciler。
 * @param options - 当前表单的创建配置与节点钩子。
 * @example
 * const runtime = createSchemaRuntime({ config })
 * const tree = runtime.connect(ports)
 * tree.reconcile(schemas)
 * runtime.dispose()
 */
export function createSchemaRuntime<TValues extends Values>(
  options: SchemaRuntimeOptions<TValues>
): SchemaRuntime<TValues> {
  // runtime 各资源在创建后立即登记，连接失败时也由同一作用域释放。
  const scope = createScope()

  // 诊断配置在表单创建时固定。
  const { config, lifecycleHooks } = options

  try {
    // 校验与依赖 effect 共用同一调度器。
    const scheduler = createScheduler(config.schedulerOptions)

    scope.add(scheduler.dispose)

    // root 信号同时供 adapter 和运行时节点读取。
    const nodeManager = createNodeManager<TValues>()

    const root = nodeManager.getRoot()

    scope.add(root.scope.dispose)
    scope.add(nodeManager.dispose)

    // 表单域通过当前路径查询字段，不持有节点索引。
    const fields = createRuntimeFieldAccess(nodeManager, root.disposed)

    /** 发布唯一表单终态。 */
    const markDisposed = (): void => {
      root.disposed.value = true
    }

    /** 即使终态订阅者抛错，也释放 runtime 的全部资源。 */
    const dispose = (): void => {
      try {
        markDisposed()
      } finally {
        scope.dispose()
      }
    }

    // timeout 为等待有效调度工作的最长时间，销毁后直接完成。
    const waitForDependencies: SchemxInstance<TValues>["waitForDependencies"] = (
      timeout
    ) => (root.disposed.value ? Promise.resolve(true) : scheduler.whenIdle(timeout))

    /**
     * 创建 compiler、节点工厂及协调器，交由 Schema 域启动首次提交。
     * @param ports - Store、校验和实例等表单依赖。
     */
    const connect = (ports: SchemaRuntimePorts<TValues>): SchemaRuntimeTree<TValues> => {
      // 同一配置只维护一份编译缓存和节点运行时。
      const compiler = createSchemaCompiler<TValues>({ config })

      scope.add(compiler.invalidateConfigCache)

      // 节点和动态行共享表单自己的身份序列。
      const nodeFactory = createRuntimeNodeFactory<TValues>(config.debug)

      const reconciler = createReconciler({
        compiler,
        nodeFactory,
        context: { ...ports, debug: config.debug, nodeManager, scheduler },
        lifecycleHooks,
      })

      scope.add(reconciler.clear)
      attachRootViewSchemas(root)

      // next 为候选配置，previous 为失败时恢复的编译配置。
      const refreshConfig: SchemaRuntimeTree<TValues>["refreshConfig"] = (
        next,
        previous
      ) => {
        compiler.setConfig(next)
        try {
          reconciler.refresh()
        } catch (error) {
          compiler.setConfig(previous)
          throw error
        }
      }

      // 读取已解析的根视图；运行时销毁后返回空列表。
      const getViewSchemas: SchemaRuntimeTree<TValues>["getViewSchemas"] = () =>
        root.disposed.value ? [] : (root.viewSchemas?.value ?? [])

      // callback 接收已提交的最新视图，订阅跟随根节点作用域释放。
      const subscribeViewSchemas: SchemaRuntimeTree<TValues>["subscribeViewSchemas"] = (
        callback
      ) => {
        if (root.disposed.value) {
          return () => {}
        }

        return subscribeRootViewSchemas(root, callback)
      }

      return {
        reconcile: reconciler.reconcile,
        refreshConfig,
        getViewSchemas,
        subscribeViewSchemas,
      }
    }

    return {
      disposed: root.disposed,
      fields,
      waitForDependencies,
      connect,
      markDisposed,
      dispose,
    }
  } catch (error) {
    scope.dispose()
    throw error
  }
}
