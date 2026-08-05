import { defaultSchemxConfigKeys, mergeAndResolveSchemxConfig } from "../config"
import {
  createSchemas,
  isSchemxSchemas,
  type SchemxSchemas,
  type SchemxSchemasInput,
} from "../createSchemas"

import { createCompile } from "./compiler"
import { createLifecycleBus, type LifecycleListener } from "./lifecycle"
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
  ResolvedSchemxSchemaConfig,
  SchemxBaseField,
  SchemxField,
  SchemxFieldSchemaPatch,
  SchemxFormApi,
  SchemxInstance,
  SchemxRendererKey,
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
  schemaConfig: ResolvedSchemxSchemaConfig
  /**
   * 未注册 renderer 的 fallback 类型。
   */
  defaultRendererType?: SchemxRendererKey
  /**
   * Runtime 生命周期钩子。
   */
  lifecycleHooks?: LifecycleListener<RuntimeNode<TValues>>
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
   * 挂载初始 Schema 并订阅后续变更；同一 Runtime 只能挂载一次。
   *
   * @param schemas - 初始 Schema 源；省略时挂载空 Schema。
   * @throws Runtime 已挂载时抛出错误。
   */
  mount(schemas?: SchemxSchemasInput<TValues>): void
  /**
   * 替换当前根 Schema。
   *
   * @param schemas - 下一版根 Schema。
   */
  setSchemas(schemas: readonly SchemxField<TValues>[]): void
  /**
   * 根据上一轮 Schema 计算并应用下一轮 Schema。
   *
   * @param updater - 接收当前根 Schema 并返回下一版根 Schema 的更新函数。
   */
  updateSchemas(
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ): void
  /**
   * 更新指定字段的静态 Schema 属性。
   *
   * @param name - 待更新字段的路径。
   * @param patch - 不改变字段结构和身份的静态属性补丁。
   */
  updateFieldSchema(name: NamePath<TValues>, patch: SchemxFieldSchemaPatch<TValues>): void
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
   * 等待 dependency effect 进入空闲状态。
   *
   * @param timeout - 最大等待时间（毫秒），默认 `10000`。
   * @returns 在超时前进入空闲状态时返回 `true`。
   */
  waitForIdle(timeout?: number): Promise<boolean>
  /**
   * 安排一次 Runtime 空闲后的 post 任务。
   *
   * @param id - 用于调度去重的任务标识。
   * @param task - Runtime 进入 post 阶段后执行的任务。
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

  // Runtime 与 Compiler 共享同一份配置引用，动态更新后无需重新装配 Compiler。
  const schemaConfig = mergeAndResolveSchemxConfig({
    schemaConfig: options.schemaConfig,
  }).schemaConfig

  // 编译 Schema 并保留当前 Form 实例引用。
  const compile = createCompile({
    schemaConfig,
    defaultRendererType: options.defaultRendererType,
    formInstance: options.instance,
  })

  // 标记 Runtime 是否已经释放。
  let disposed = false

  // 标记初始 Schema 是否已经挂载。
  let mounted = false

  // 当前 Runtime 持有的响应式 Schema 源。
  let schemaSource: SchemxSchemas<TValues> | undefined

  // Runtime 内部共享的最小服务上下文。
  const context: SchemaRuntimeContext<TValues> = {
    schemaConfig,
    instance: options.instance,
    model: options.model,
    formApi: options.formApi,
    compile,
    scheduler,
    // 将字段校验同步和移除操作委托给外部 Model。
    validation: {
      syncField: options.model.syncValidationField,
      removeField: options.model.removeValidationField,
    },
    lifecycleBus,
    nodeResources,
    // 统一由 reconciler 提交子 descriptor，避免各调用方绕过节点协调流程。
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
  const applySchemas = (nextSchemas: readonly SchemxField<TValues>[]): void => {
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
  const assertMounted = (): SchemxSchemas<TValues> => {
    if (!schemaSource || !mounted) {
      throw new Error("[schemx] Schema runtime is not mounted.")
    }

    return schemaSource
  }

  /**
   * 挂载 Schema 源并注册其变更订阅。
   */
  const mount = (schemasInput?: SchemxSchemasInput<TValues>): void => {
    if (mounted) {
      throw new Error("[schemx] Schema runtime is already mounted.")
    }

    if (disposed) {
      return
    }

    mounted = true
    schemaSource = isSchemxSchemas(schemasInput)
      ? schemasInput
      : createSchemas<TValues>(schemasInput ?? [])

    applySchemas(schemaSource.peek())
    scope.add(schemaSource.subscribe(applySchemas))
  }

  /**
   * 用完整根 Schema 替换已挂载的 Schema 源。
   */
  const setSchemas = (nextSchemas: readonly SchemxField<TValues>[]): void => {
    if (disposed) {
      return
    }

    assertMounted().set(nextSchemas)
  }

  /**
   * 基于当前根 Schema 原子地计算下一版配置。
   */
  const updateSchemas = (
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ): void => {
    if (disposed) {
      return
    }

    assertMounted().update(updater)
  }

  /**
   * 重新编译并协调单个字段的静态属性补丁。
   */
  const updateFieldSchema = (
    name: NamePath<TValues>,
    patch: SchemxFieldSchemaPatch<TValues>
  ): void => {
    if (disposed) {
      return
    }

    // 根据字段名找到当前 RuntimeNode。
    const node = nodeResources.fieldIndex.getByName(name)

    if (!node) {
      return
    }

    // 当前字段 descriptor；容器或未编译节点不参与字段更新。
    const current = node.descriptor

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

    // staticSchema 的 componentType 与 name 不变，因此该断言不会改变字段结构；
    // 它只补回对象展开后 TypeScript 无法保留的 Renderer 判别关联。
    const nextRawSchema = {
      ...current.staticSchema,
      ...patch,
      componentProps,
      key: current.key,
      name: current.name,
      componentType: current.staticSchema.componentType,
      dependencies: current.dynamicProps?.dependencies,
    } as SchemxField<TValues>

    // 单字段重新编译得到的最新 descriptor。
    const [next] = compile.toDescriptors([nextRawSchema])

    if (next.type === "field") {
      reconciler.updateNode(node, next)
    }
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
    applySchemas(assertMounted().peek())
  }

  /**
   * 读取字段当前的动态生效配置。
   */
  const getEffectiveFieldSchema = (
    name: NamePath<TValues>
  ): Pick<SchemxBaseField<TValues>, "label" | "required"> | undefined => {
    return nodeResources.fieldIndex.getByName(name)?.fieldState?.effectiveSchema.value
  }

  /**
   * 读取根节点维护的视图 Schema 投影。
   */
  const getViewSchemas = (): readonly SchemxViewSchema<TValues>[] => {
    // 根节点维护的视图投影状态。
    const rootViewState = root.viewState

    if (!rootViewState || !("viewSchemas" in rootViewState)) {
      return []
    }

    return rootViewState.viewSchemas.value
  }

  /**
   * 订阅根节点视图 Schema 的变化。
   */
  const subscribeRuntimeViewSchemas = (
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ): (() => void) => {
    return subscribeViewSchemas(root, nodeResources, callback)
  }

  /**
   * 等待调度器及 dependency effect 完成当前批次。
   */
  const waitForIdle = (timeout = 10000): Promise<boolean> => {
    return scheduler.whenIdle(timeout)
  }

  /**
   * 在当前 Runtime 的作用域内注册 post 阶段任务。
   */
  const deferPostTask = (id: string, task: () => void): void => {
    scheduler.schedule({
      id,
      priority: "post",
      scope,
      run: task,
    })
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
    reconciler.removeNode(root)
    scheduler.dispose()
    lifecycleBus.clear()
    schemaSource = undefined
  }

  return {
    root,
    mount,
    setSchemas,
    updateSchemas,
    updateFieldSchema,
    updateSchemaConfig,
    getEffectiveFieldSchema,
    getViewSchemas,
    subscribeViewSchemas: subscribeRuntimeViewSchemas,
    waitForIdle,
    deferPostTask,
    dispose,
  }
}
