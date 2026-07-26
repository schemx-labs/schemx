import { pick } from "es-toolkit"

import {
  createSchemas,
  isSchemxSchemas,
  type SchemxSchemas,
  type SchemxSchemasInput,
} from "../createSchemas"
import { defaultConfigKey, resolveDefaultConfig } from "../defaultConfig"

import { createCompile } from "./compiler"
import { createLifecycleBus, type SchemxLifecycleHooks } from "./lifecycle"
import {
  type ContainerRuntimeNode,
  createRuntimeResources,
  createScope,
  type RootRuntimeNode,
  type RuntimeNode,
} from "./node"
import { createReconciler } from "./reconciler"
import { createScheduler } from "./scheduler"
import { subscribeViewSchemas } from "./view"
import { createRootRuntimeViewState } from "./view/createViewState"

import type { SchemaRuntimeContext } from "./context"
import type { SchemxViewSchema } from "./view"
import type { RuntimeFormModelPort } from "../form/model"
import type {
  NamePath,
  ResolvedSchemxDefaultProps,
  SchemxBaseField,
  SchemxDefaultProps,
  SchemxField,
  SchemxFieldSchemaPatch,
  SchemxFormApi,
  SchemxInstance,
  SchemxRendererKey,
  Values,
} from "../types"

/**
 * 创建 SchemaRuntime 所需的依赖。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface CreateSchemaRuntimeOptions<TValues extends Values> {
  /**
   * Runtime 访问字段状态与校验的最小 Model Port。
   */
  model: RuntimeFormModelPort<TValues>
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
  defaultProps: ResolvedSchemxDefaultProps
  /**
   * 未注册 renderer 的 fallback 类型。
   */
  defaultRendererType?: SchemxRendererKey
  /**
   * Runtime 生命周期钩子。
   */
  lifecycleHooks?: SchemxLifecycleHooks<TValues>
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
  readonly root: RootRuntimeNode<TValues>
  /**
   * 挂载初始 Schema；同一 Runtime 只能挂载一次。
   */
  mount(schemas?: SchemxSchemasInput<TValues>): void
  /**
   * 替换当前根 Schema。
   */
  setSchemas(schemas: readonly SchemxField<TValues>[]): void
  /**
   * 根据上一轮 Schema 计算并应用下一轮 Schema。
   */
  updateSchemas(
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ): void
  /**
   * 更新指定字段的静态 Schema 属性。
   */
  updateFieldSchema(name: NamePath<TValues>, patch: SchemxFieldSchemaPatch<TValues>): void
  /**
   * 更新字段默认属性并重新编译当前 Schema。
   */
  updateDefaultProps(partial: Partial<SchemxDefaultProps>): void
  /**
   * 获取字段当前生效的 label 与 required 配置。
   */
  getEffectiveFieldSchema(
    name: NamePath<TValues>
  ): Pick<SchemxBaseField<TValues>, "label" | "required"> | undefined
  /**
   * 获取当前视图 Schema 快照。
   */
  getViewSchemas(): readonly SchemxViewSchema<TValues>[]
  /**
   * 订阅视图 Schema 变化，并返回取消订阅函数。
   */
  subscribeViewSchemas(
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ): () => void
  /**
   * 等待 dependency effect 进入空闲状态。
   */
  waitForIdle(timeout?: number): Promise<boolean>
  /**
   * 安排一次 Runtime 空闲后的 post 任务。
   */
  deferPostTask(id: string, task: () => void): void
  /**
   * 幂等释放 Runtime 的节点、调度器和订阅资源。
   */
  dispose(): void
}

/**
 * 创建一个独立的 SchemaRuntime。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Runtime 所需的 Model、实例、API 和默认配置。
 * @returns 可挂载和更新 Schema 的 Runtime。
 *
 * @remarks
 * Runtime 只依赖 `RuntimeFormModelPort`，不会直接访问完整 FormModel 的内部实现。
 */
export function createSchemaRuntime<TValues extends Values>(
  options: CreateSchemaRuntimeOptions<TValues>
): SchemaRuntime<TValues> {
  // 管理 Runtime 内部订阅、调度任务和销毁顺序。
  const scope = createScope()

  // 执行 dependency 与 post 阶段任务。
  const scheduler = createScheduler()

  // 提供跨节点资源索引和字段查询能力。
  const nodeResources = createRuntimeResources<TValues>()

  // 广播 Runtime 生命周期事件。
  const lifecycleBus = createLifecycleBus<RuntimeNode<TValues>>(options.lifecycleHooks)

  // 编译 Schema 并保留当前 Form 实例引用。
  const compile = createCompile({
    defaultProps: options.defaultProps,
    defaultRendererType: options.defaultRendererType,
    formInstance: options.instance,
  })

  // 标记 Runtime 是否已经释放。
  let disposed = false

  // 标记初始 Schema 是否已经挂载。
  let mounted = false

  // 当前 Runtime 持有的响应式 Schema 源。
  let schemas: SchemxSchemas<TValues> | undefined

  // Runtime 内部共享的最小服务上下文。
  const context: SchemaRuntimeContext<TValues> = {
    defaultProps: options.defaultProps,
    instance: options.instance,
    model: options.model,
    formApi: options.formApi,
    compile,
    scheduler,
    validation: {
      syncField: options.model.syncValidationField,
      removeField: options.model.removeValidationField,
    },
    lifecycleBus,
    nodeResources,
    commitChildren(parent, descriptors) {
      reconciler.reconcileChildren(parent, descriptors)
    },
  }

  // 根据 descriptor 增量创建、更新和卸载 RuntimeNode。
  const reconciler = createReconciler<TValues>(context)

  // Runtime 根节点及其视图状态。
  const root = reconciler.createRoot()

  createRootRuntimeViewState(root, nodeResources)

  /**
   * 将最新 Schema 编译为 descriptor 并提交给根节点。
   */
  function applySchemas(nextSchemas: readonly SchemxField<TValues>[]): void {
    if (disposed) {
      return
    }

    // 当前 Schema 编译得到的 Runtime descriptor 列表。
    const descriptors = compile.toDescriptors(nextSchemas)

    reconciler.reconcileChildren(root as ContainerRuntimeNode<TValues>, descriptors)
  }

  /**
   * 获取已挂载的响应式 Schema 源，否则抛出生命周期错误。
   */
  function assertMounted(): SchemxSchemas<TValues> {
    if (!schemas || !mounted) {
      throw new Error("[schemx] Schema runtime is not mounted.")
    }

    return schemas
  }

  return {
    root,
    mount(schemasInput) {
      if (mounted) {
        throw new Error("[schemx] Schema runtime is already mounted.")
      }

      if (disposed) {
        return
      }

      mounted = true
      schemas = isSchemxSchemas(schemasInput)
        ? schemasInput
        : createSchemas<TValues>(schemasInput ?? [])

      applySchemas(schemas.peek())
      scope.add(schemas.subscribe(applySchemas))
    },
    setSchemas(nextSchemas) {
      if (disposed) {
        return
      }

      assertMounted().set(nextSchemas)
    },
    updateSchemas(updater) {
      if (disposed) {
        return
      }

      assertMounted().update(updater)
    },
    updateFieldSchema(name, patch) {
      if (disposed) {
        return
      }

      // 根据字段名找到当前 RuntimeNode。
      const node = nodeResources.fieldIndex.getByName(name)

      if (!node) {
        return
      }

      // 当前字段 descriptor；容器或未编译节点不参与字段更新。
      const current = node.descriptor ?? undefined

      if (current?.type !== "field") {
        return
      }

      // 合并静态 componentProps，避免更新字段时丢失既有属性。
      const componentProps = patch.componentProps
        ? {
            ...current.staticSchema.componentProps,
            ...patch.componentProps,
          }
        : current.staticSchema.componentProps

      // 保留 RuntimeNode 身份信息并构造下一版字段 Schema。
      const nextRawSchema: SchemxBaseField<TValues> = {
        ...current.staticSchema,
        ...patch,
        componentProps,
        key: current.key,
        name: current.name,
        componentType: current.staticSchema.componentType,
        dependencies: current.dynamicProps?.dependencies,
      }

      // 只编译当前字段，减少局部 Schema 更新的开销。
      const [next] = compile.toDescriptors([nextRawSchema])

      if (next.type === "field") {
        reconciler.updateNode(node, next)
      }
    },
    updateDefaultProps(partial) {
      if (disposed) {
        return
      }

      Object.assign(
        context.defaultProps,
        resolveDefaultConfig(context.defaultProps, pick(partial, defaultConfigKey))
      )
      compile.invalidate()
      applySchemas(assertMounted().peek())
    },
    getEffectiveFieldSchema(name) {
      return nodeResources.fieldIndex.getByName(name)?.fieldState?.effectiveSchema.value
    },
    getViewSchemas() {
      // 根节点维护的视图投影状态。
      const rootViewState = root.viewState

      if (!rootViewState || !("viewSchemas" in rootViewState)) {
        return []
      }

      return rootViewState.viewSchemas.value
    },
    subscribeViewSchemas(callback) {
      return subscribeViewSchemas(root, nodeResources, callback)
    },
    waitForIdle(timeout = 10000) {
      return scheduler.whenIdle(timeout)
    },
    deferPostTask(id, task) {
      scheduler.schedule({
        id,
        priority: "post",
        scope,
        run: task,
      })
    },
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      scope.dispose()
      reconciler.removeNode(root)
      scheduler.dispose()
      lifecycleBus.clear()
      schemas = undefined
    },
  }
}
