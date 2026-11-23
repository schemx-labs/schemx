/**
 * 表单实例工厂 - 框架无关的核心实现。
 *
 * createForm 是表单内核的唯一公开装配入口。
 *
 * @module core/createForm
 *
 * @example
 * ```ts
 * import { createForm } from '@schemx/core'
 *
 * // 创建基础表单
 * const form = createForm({
 *   initialValues: { username: '', email: '' }
 * })
 *
 * // 设置字段值
 * form.setFieldValue('username', 'John')
 *
 * // 获取字段值
 * const username = form.getFieldValue('username')
 *
 * // 校验并提交
 * const result = await form.validate()
 * if (result.ok) {
 *   console.log('提交数据:', result.values)
 * }
 * ```
 *
 * @example
 * ```ts
 * // 带 schemas 和回调的完整表单
 * const form = createForm({
 *   schemas: [
 *     { name: 'username', label: '用户名', componentType: 'input' },
 *     { name: 'email', label: '邮箱', componentType: 'input' }
 *   ],
 *   initialValues: { username: '', email: '' },
 *   onValuesChange: (changed, latest) => {
 *     console.log('字段变化:', changed)
 *   },
 *   onFinish: (values) => {
 *     console.log('提交:', values)
 *   },
 *   onFinishFailed: (error) => {
 *     console.log('校验失败:', error.errors)
 *   }
 * })
 *
 * // 使用 effect 监听值变化
 * const dispose = form.effect(() => {
 *   console.log('当前值:', form.getFieldsValue())
 *   console.log('错误:', form.getFieldError('email'))
 * })
 *
 * // 提交表单
 * await form.submit()
 *
 * // 清理
 * dispose()
 * form.destroy()
 * ```
 */

import { pick } from "es-toolkit"

import {
  createSchemas,
  isSchemxSchemas,
  type SchemxSchemas,
  type SchemxSchemasInput,
} from "./createSchemas"
import { defaultConfigKey } from "./defaultConfig"
import { compileToDescriptors } from "./descriptor"
import { createFieldRegistry, type FieldRegistry } from "./field"
import {
  createLifecycleBus,
  type LifecycleBus,
  type SchemxLifecycleHooks,
} from "./lifecycle/lifecycle"
import {
  type ContainerRuntimeNode,
  createReconciler,
  createScope,
  FieldRuntimeNode,
  findFieldRuntimeNode,
  type Reconciler,
  type RootRuntimeNode,
  type RuntimeNodeManager,
  type Scope,
} from "./node"
import { createRuntimeNodeManager } from "./node/runtimeNodeManager"
import { batchUpdates, createSignalEffect } from "./reactivity"
import {
  createRendererRegistry,
  createValidatorsRegistry,
  type RendererRegistryType,
  type ValidatorsRegistryType,
} from "./registry"
import { createScheduler, type Scheduler } from "./scheduler"
import { createStore, type Store } from "./store"
import { collectObjectPathsByLeaf, diff, withLock } from "./utils"
import {
  createRequiredRule,
  createSelectRequiredRule,
  createUploadRequiredRule,
  createValidator,
  type ValidateError,
  type ValidateResult,
  type Validator,
} from "./validator"
import {
  buildViewSchemas,
  createViewRevision,
  type SchemxViewSchema,
  subscribeViewSchemas,
  type ViewRevision,
} from "./view"

import type { FormDescriptor } from "./descriptor"
import type {
  NamePath,
  SchemxBaseField,
  SchemxDefaultProps,
  SchemxField,
  SchemxFormApi,
  SchemxInstance,
  SchemxRendererKey,
  SchemxRules,
  StandardSchemaV1,
  Values,
} from "./types"

type Callbacks<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = Pick<
  CreateFormOptions<TValues, TName>,
  "onValuesChange" | "onFinish" | "onFinishFailed" | "onFieldsChange"
>

/**
 * createForm 内部运行时上下文。
 *
 * 字段、dependency effect 和 node lifecycle 通过该对象共享 store、
 * validator、scheduler、registry 以及唯一的子树提交边界。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface SchemxFormContext<TValues extends Values = Values> {
  /**
   * schema 编译默认选项，供 root 与 dependency 子树复用
   */
  defaultProps: SchemxDefaultProps
  /**
   * 表单实例，定义表单的所有操作方法
   */
  readonly instance: SchemxInstance<TValues>
  /**
   * 获取传递给动态 renderer 的表单 API。
   *
   * @returns 当前表单实例的公开操作 API。
   */
  readonly formApi: SchemxFormApi<TValues>

  /**
   * 运行时异步调度器，用于追踪 dependency renderer 和字段动态依赖
   */
  readonly scheduler: Scheduler
  /**
   * node 生命周期事件总线，连接 reconciler 与字段资源挂载流程
   */
  readonly lifecycleBus: LifecycleBus<FieldRuntimeNode<TValues>>
  /**
   * 字段 RuntimeNode 到字段模型的注册表，供表单 API 和视图投影读取
   */
  readonly fieldRegistry: FieldRegistry<TValues>
  /**
   * 唯一子节点提交边界，负责 reconcile 后推进 viewRevision。
   *
   * @param parent - 接收子节点的容器 RuntimeNode。
   * @param descriptors - 新一轮编译得到的子 descriptor 列表。
   */
  commitChildren(
    parent: ContainerRuntimeNode<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void
}

/**
 * 创建表单实例的配置项。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - 字段路径类型
 *
 * @example
 * ```ts
 * const options: CreateFormOptions = {
 *   // 静态 schema 数组
 *   schemas: [
 *     { name: 'username', label: '用户名', componentType: 'input' }
 *   ],
 *
 *   // 初始值
 *   initialValues: { username: '' },
 *
 *   // 受控值（可选）
 *   modelValue: { username: 'test' },
 *
 *   // 自定义渲染器注册中心
 *   rendererRegistry: createRendererRegistry(),
 *
 *   // 回调函数
 *   onValuesChange: (changed, latest) => {},
 *   onFinish: (values) => {},
 *   onFinishFailed: (error) => {},
 *   onFieldsChange: (changed, all) => {}
 * }
 *
 * const form = createForm(options)
 * ```
 *
 * @example
 * ```ts
 * // 使用 createSchemas 创建响应式 schemas
 * const schemas = createSchemas([
 *   { name: 'username', label: '用户名', componentType: 'input' }
 * ])
 *
 * const form = createForm({ schemas })
 *
 * // 后续可动态更新 schemas
 * schemas.update(prev => [...prev, newSchema])
 * ```
 */
export interface CreateFormOptions<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> extends SchemxDefaultProps {
  /**
   * schema 列表或可响应式更新的 schema source。dependency schema 会在运行时透明展开。
   */
  schemas?: SchemxSchemasInput<TValues>
  /**
   * 表单初始值，作为 reset 的还原基准。
   */
  initialValues?: TValues
  /**
   * 外部受控表单值。
   */
  modelValue?: TValues
  /**
   * 当前 form 实例使用的渲染器注册表。
   */
  rendererRegistry?: RendererRegistryType
  /**
   * 字段未指定可用渲染器时使用的默认 renderer type。
   */
  defaultRendererType?: SchemxRendererKey
  /**
   * 当前 form 实例使用的规则注册表。
   */
  validatorRegistry?: ValidatorsRegistryType

  /**
   * submit 校验通过后的回调。
   */
  onFinish?: (values: Readonly<TValues>) => void | Promise<void>
  /**
   * submit 校验失败后的回调。
   */
  onFinishFailed?: (error: ValidateError<TValues>) => void
  /**
   * 字段值变化后的回调，接收本次变化片段和最新快照。
   */
  onValuesChange?: (
    changedValues: Readonly<Partial<TValues>>,
    latestSnapshot: Readonly<TValues> | TValues
  ) => void
  /**
   * 字段路径变化后的回调，接收本次变化路径和所有已知字段路径。
   */
  onFieldsChange?: (changedFields: TName[], allFields: TName[]) => void
  /**
   * node lifecycle hook，用于观察字段节点挂载、更新和卸载。
   */
  lifecycleHooks?: SchemxLifecycleHooks<TValues>
}

class CreateForm<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 表单内部上下文，集中持有全局配置和运行时服务 */
  private context: SchemxFormContext<TValues>

  /** 用户传入的表单级回调集合 */
  readonly callbacks: Callbacks<TValues>

  /** 表单状态存储，管理字段值、初始值和订阅 */
  private store: Store<TValues>

  /** 渲染器注册表，解析 schema.componentType 到具体渲染实现 */
  readonly rendererRegistry: RendererRegistryType

  /** 校验规则注册表，解析字符串规则名称到 StandardSchema 或规则工厂 */
  readonly validatorRegistry: ValidatorsRegistryType<TValues>

  /** 字段校验器，维护规则、错误状态和校验执行流程 */
  readonly validator: Validator<TValues>

  /** Runtime node 的透明根节点，承载所有编译后的表单描述符节点 */
  readonly root: RootRuntimeNode<TValues>

  /** 运行时异步调度器，用于追踪 dependency renderer 和字段动态依赖 */
  readonly scheduler: Scheduler

  /** 视图结构版本号，node 结构变化时推进以触发 ViewSchemas 重新构建 */
  readonly viewRevision: ViewRevision

  /** descriptor 到 RuntimeNode tree 的协调器，负责创建、复用和销毁节点 */
  readonly reconciler: Reconciler<TValues>

  /** 单个 RuntimeNode 生命周期执行器，负责挂载和释放运行期资源 */
  readonly runtimeNodeManager: RuntimeNodeManager<TValues>

  /** 字段 RuntimeNode 到字段模型的注册表，供表单 API 和视图投影读取 */
  readonly fieldRegistry: FieldRegistry<TValues>

  /** 表单级资源作用域，统一管理回调 effect 等非 RuntimeNode 资源 */
  private readonly scope: Scope = createScope()

  /** root schema 的统一数据源 */
  private schemas: SchemxSchemas<TValues>

  /** 标记表单实例是否已销毁，保证 dispose 幂等 */
  private disposed = false

  /** node 生命周期事件总线，连接 reconciler 与字段资源挂载流程 */
  private lifecycleBus: LifecycleBus<FieldRuntimeNode<TValues>>

  constructor(options: CreateFormOptions<TValues> = {}) {
    const {
      schemas: schemasInput,
      initialValues = {} as TValues,
      modelValue,
      rendererRegistry,
      defaultRendererType,
      validatorRegistry,
      ...restOptions
    } = options

    // 统一保存用户回调，后续 effect 和 submit 流程从同一入口读取。
    this.callbacks = {
      onValuesChange: options.onValuesChange,
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
      onFieldsChange: options.onFieldsChange,
    }

    // 注册表允许外部注入；未注入时创建表单实例私有注册表，避免跨实例污染。
    this.rendererRegistry =
      rendererRegistry ?? createRendererRegistry(defaultRendererType)

    this.validatorRegistry = (validatorRegistry ??
      createValidatorsRegistry<TValues>()) as ValidatorsRegistryType<TValues>

    this.validator = createValidator<TValues, TName>()

    // modelValue 优先覆盖 initialValues，用于受控场景的初始快照对齐。
    this.store = createStore<TValues>({
      initialValues: { ...initialValues, ...(modelValue ?? {}) },
    })

    // 内置必填类规则默认注册到当前表单，用户仍可通过规则注册表覆盖。
    this.validatorRegistry.registerAll({
      required: createRequiredRule,
      selectRequired: createSelectRequiredRule,
      uploadRequired: createUploadRequiredRule,
    })

    // 生命周期总线连接 node 结构变化与字段模型、依赖资源的挂载和更新流程。
    this.lifecycleBus = createLifecycleBus<FieldRuntimeNode<TValues>>()

    // 初始化运行时 node 所需的核心基础设施。
    this.scheduler = createScheduler()
    this.viewRevision = createViewRevision()
    this.fieldRegistry = createFieldRegistry<TValues>()

    // dependency renderer 运行时需要回写 node，因此上下文在首次编译前准备好。
    this.context = {
      defaultProps: pick(restOptions, defaultConfigKey),
      instance: this.getFormInstance(),
      formApi: this.getFormApi(),
      scheduler: this.scheduler,
      lifecycleBus: this.lifecycleBus,
      fieldRegistry: this.fieldRegistry,
      commitChildren: this.commitChildren,
    }

    this.runtimeNodeManager = createRuntimeNodeManager<TValues>(this.context)

    this.reconciler = createReconciler(this.runtimeNodeManager)

    this.root = this.runtimeNodeManager.createRoot()

    if (options.lifecycleHooks) {
      this.lifecycleBus.on(options.lifecycleHooks)
    }

    // 无论调用方传入静态数组还是 createSchemas 返回的 source，
    // 内部都统一成 schema source，避免初始化与后续 set/update 走两套状态。
    this.schemas = isSchemxSchemas(schemasInput)
      ? schemasInput
      : createSchemas<TValues>(schemasInput ?? [])

    // 将外部 schema 编译成内部 descriptor tree，再交给 reconciler 建立 runtime node。
    this.applySchemas(this.schemas.peek())

    const schemasDisposer = this.schemas.subscribe((nextSchemas) => {
      this.applySchemas(nextSchemas)
    })

    this.scope.add(schemasDisposer)

    // 注册值变化回调（通过 store.effect 自动追踪依赖）
    if (this.callbacks?.onValuesChange || this.callbacks?.onFieldsChange) {
      let prevSnapshot = this.store.getFieldsSnapshot()

      const valuesChangeDisposer = createSignalEffect(() => {
        const latestValues = this.store.getFieldsValue()
        const latestSnapshot = this.store.getFieldsSnapshot()

        const changedValues = diff(latestSnapshot, prevSnapshot)

        const changedPaths = collectObjectPathsByLeaf<TValues, TName>(changedValues)

        if (changedPaths.length > 0) {
          this.callbacks.onValuesChange?.(changedValues, latestSnapshot)

          this.callbacks.onFieldsChange?.(
            changedPaths,
            collectObjectPathsByLeaf(latestValues)
          )
        }

        prevSnapshot = latestSnapshot
      })

      this.scope.add(valuesChangeDisposer)
    }
  }

  /**
   * 表单实例接口
   *
   * 定义表单的所有操作方法，是 useForm 返回值的基础接口。
   * SchemxInstance 类实现此接口，提供完整的表单操作能力。
   */
  getFormInstance = (): SchemxInstance<TValues> => {
    return {
      setFieldValue: this.store.setFieldValue.bind(this.store),
      setFieldsValue: this.store.setFieldsValue.bind(this.store),
      getFieldValue: this.store.getFieldValue.bind(this.store),
      getFieldsValue: this.store.getFieldsValue.bind(this.store),
      getFieldSnapshot: this.store.getFieldSnapshot.bind(this.store),
      getFieldsSnapshot: this.store.getFieldsSnapshot.bind(this.store),
      getInitialValue: this.store.getInitialValue.bind(this.store),
      getInitialValues: this.store.getInitialValues.bind(this.store),
      setInitialValues: this.store.setInitialValues.bind(this.store),
      isFieldTouched: this.store.isFieldTouched.bind(this.store),
      setFieldTouched: this.store.setFieldTouched.bind(this.store),
      getTouchedFields: this.store.getTouchedFields.bind(this.store),
      setFieldPending: this.store.setFieldPending.bind(this.store),
      isFieldPending: this.store.isFieldPending.bind(this.store),
      getPendingFields: this.store.getPendingFields.bind(this.store),
      validateField: this.validateField.bind(this),
      validate: this.validate.bind(this),
      getFieldError: this.validator.getFieldError.bind(this.validator),
      setFieldError: this.validator.setFieldError.bind(this.validator),
      resetFields: this.store.resetFields.bind(this.store),
      reset: this.reset.bind(this),
      submit: this.submit.bind(this),

      registerRules: this.register.bind(this),
      unregisterRules: this.validator.unregister.bind(this.validator),

      effect: this.effect.bind(this),
      batch: this.batch.bind(this),

      setSchemas: this.setSchemas.bind(this),
      updateSchemas: this.updateSchemas.bind(this),
      updateDefaultProps: this.updateDefaultProps.bind(this),
      getViewRevision: () => this.viewRevision.revision.value,
      getViewSchemas: this.getViewSchemas.bind(this),
      subscribeViewSchemas: this.subscribeViewSchemas.bind(this),
      waitForDependencies: this.waitForIdle.bind(this),

      getRenderer: this.rendererRegistry.getRenderer.bind(this.rendererRegistry),
      registerRenderer: this.rendererRegistry.register.bind(this.rendererRegistry),
      hasRenderer: this.rendererRegistry.hasRenderer.bind(this.rendererRegistry),

      getValidator: this.validatorRegistry.get.bind(this.validatorRegistry),
      registerValidator: this.validatorRegistry.register.bind(this.validatorRegistry),
      hasValidator: this.validatorRegistry.has.bind(this.validatorRegistry),

      destroy: this.destroy.bind(this),
    }
  }

  /**
   * 表单 API，提供与表单交互的方法。
   *
   * 传递给动态渲染器，允许程序化操作表单。
   */
  private getFormApi = (): SchemxFormApi<TValues> => {
    return {
      setValue: this.store.setFieldValue.bind(this.store),
      setValues: this.store.setFieldsValue.bind(this.store),
      getValue: this.store.getFieldValue.bind(this.store),
      getValues: this.store.getFieldsValue.bind(this.store),
      getSnapshots: this.store.getFieldsSnapshot.bind(this.store),
      setPending: this.store.setFieldPending.bind(this.store),
      isPending: this.store.isFieldPending.bind(this.store),
      setTouched: this.store.setFieldTouched.bind(this.store),
      isTouched: this.store.isFieldTouched.bind(this.store),
      getError: this.validator.getFieldError.bind(this.validator),
      setError: this.validator.setFieldError.bind(this.validator),
      resetFields: this.store.resetFields.bind(this.store),
      reset: this.reset.bind(this),
      validateField: this.validateField.bind(this),
      validate: this.validate.bind(this),
    }
  }

  /**
   * 注册字段校验规则
   */
  private register(
    path: NamePath<TValues>,
    rules: SchemxRules | SchemxRules[],
    defaultMessage?: string
  ): void {
    const resolvedRules: StandardSchemaV1[] = []

    const node = findFieldRuntimeNode(this.root, path)

    const schema = node?.descriptor.schema

    this.validator.unregister(path)

    const schemaWithRules = {
      ...schema,
      rules,
    } as SchemxBaseField<TValues>

    resolvedRules.push(
      ...this.validatorRegistry.resolveValidatorsBySchema(schemaWithRules)
    )

    if (resolvedRules.length > 0) {
      this.validator.register(path, resolvedRules, defaultMessage)
    }
  }

  /**
   * 校验指定字段
   */
  private async validateField(name: NamePath<TValues>): Promise<ValidateResult<TValues>> {
    const result = await this.validator.validateField(name, this.store.getFieldsValue())

    return result
  }

  /**
   * 校验所有已注册字段
   *
   * 校验前检查是否有字段处于操作中状态，有则直接返回失败结果。
   */
  private validate = withLock(async (): Promise<ValidateResult<TValues>> => {
    const pendingFields = this.store.getPendingFields()

    if (pendingFields.length > 0) {
      const defaultMessage = `存在正在操作中的字段: ${pendingFields.map((i) => i.field).join(", ")}，请等待完成后再提交`

      console.warn(`[schemx] ${defaultMessage}`)

      return {
        ok: false,
        error: {
          errors: pendingFields.map(({ field, message }) => {
            const _message = message.length ? message : ["字段正在处理中，请稍后重试"]

            this.validator.setFieldError(field as NamePath<TValues>, _message)

            return {
              field: field as string,
              message: _message,
            }
          }),
          values: this.store.getFieldsSnapshot(),
        },
      }
    }

    const result = await this.validator.validate(this.store.getFieldsValue())

    return result
  })

  /**
   * 重置整个表单到初始值
   */
  private reset(): void {
    this.store.reset()
    this.validator.reset()
  }

  /**
   * 提交表单
   */
  private submit = withLock(async (): Promise<void> => {
    // 等待依赖解析完成
    const depsReady = await this.waitForIdle()
    if (!depsReady) {
      // 超时则拒绝提交
      return
    }

    const result = await this.validate()
    if (result.ok) {
      await this.callbacks.onFinish?.(result.values)
    } else {
      this.callbacks.onFinishFailed?.(result.error)
    }
  })

  /**
   * 创建 reactive effect。
   *
   * 回调内调用 getFieldValue / getFieldError 时自动追踪依赖，
   * 跨越 store 和 validator 的 reactive maps。
   * dispose 函数由 createForm 层面统一管理，destroy 时清理。
   */
  private effect(fn: () => void): () => void {
    const dispose = createSignalEffect(fn)
    const handle = this.scope.add(dispose)

    return () => {
      handle.dispose()
    }
  }

  /**
   * 批量更新，合并多次 reactive 写入。
   *
   * 将多次 reactive 写入合并为一次 effect 触发，
   * 跨越 store 和 validator 的 reactive maps。
   */
  private batch(fn: () => void): void {
    batchUpdates(fn)
  }

  /**
   * 替换 root schemas。
   */
  private setSchemas(schemas: readonly SchemxField<TValues>[]): void {
    if (this.disposed) {
      return
    }

    this.schemas.set(schemas)
  }

  /**
   * 基于当前 root schemas 派生下一版 schemas。
   */
  private updateSchemas(
    updater: (schemas: readonly SchemxField<TValues>[]) => readonly SchemxField<TValues>[]
  ): void {
    if (this.disposed) {
      return
    }

    this.schemas.update(updater)
  }

  /**
   * 更新表单默认配置。
   *
   * 合并传入属性到当前 defaultProps，然后重新编译根 schemas 并 reconcile。
   * 字段级属性未设置时会回退到这些默认值。
   */
  private updateDefaultProps(partial: Partial<SchemxDefaultProps>): void {
    if (this.disposed) {
      return
    }

    Object.assign(this.context.defaultProps, pick(partial, defaultConfigKey))

    this.applySchemas(this.schemas.peek())
  }

  /**
   * 将 schema source 的当前值提交到 runtime node。
   */
  private applySchemas(schemas: readonly SchemxField<TValues>[]): void {
    if (this.disposed) {
      return
    }

    const previousRevision = this.viewRevision.revision.value
    const descriptors = compileToDescriptors([...schemas], this.context.defaultProps)

    this.commitChildren(this.root as ContainerRuntimeNode<TValues>, descriptors)

    if (this.viewRevision.revision.value === previousRevision) {
      this.viewRevision.bump()
    }
  }

  /**
   * 唯一子节点提交边界。
   *
   * 所有结构输入先编译成 descriptor，再经由这里提交到某个 parent RuntimeNode。
   * Reconciler 只负责 node 结构；public commit 完成后由这里推进一次 viewRevision。
   */
  private commitChildren = (
    parentNode: ContainerRuntimeNode<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void => {
    const changed = this.reconciler.reconcileChildren(parentNode, descriptors)

    if (changed) {
      this.viewRevision.bump()
    }
  }

  /**
   * 销毁表单实例
   *
   * 清除所有订阅回调和 effect，释放资源。通常在组件卸载时调用。
   */
  private destroy(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true

    this.scope.dispose()
    this.runtimeNodeManager.disposeTree(this.root)
    this.scheduler.dispose()
    this.store.destroy()
  }

  /**
   * 获取当前 ViewSchemas。
   */
  private getViewSchemas(): readonly SchemxViewSchema<TValues>[] {
    return buildViewSchemas<TValues>(this.root)
  }

  /**
   * 订阅 ViewSchemas 变化。
   */
  private subscribeViewSchemas(
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ): () => void {
    return subscribeViewSchemas<TValues>(this.root, this.viewRevision, callback)
  }

  /**
   * 等待内部异步任务完成。
   */
  private waitForIdle(timeout: number = 10000): Promise<boolean> {
    return this.scheduler.whenIdle(timeout)
  }
}

/**
 * 创建 Schemx 表单实例。
 *
 * @param options - 表单配置项
 * @returns 表单实例
 *
 * @example
 * ```ts
 * // 基础用法
 * const form = createForm({
 *   initialValues: { name: '', age: 0 }
 * })
 *
 * // 完整配置
 * const form = createForm({
 *   schemas: [
 *     { name: 'name', label: '姓名', componentType: 'input' },
 *     { name: 'age', label: '年龄', componentType: 'number' }
 *   ],
 *   initialValues: { name: '', age: 0 },
 *   onValuesChange: (changed, latest) => {
 *     console.log('变化:', changed)
 *   },
 *   onFinish: (values) => submit(values),
 *   onFinishFailed: (error) => showErrors(error)
 * })
 * ```
 */
export function createForm<TValues extends Values>(
  options: CreateFormOptions<TValues> = {}
): SchemxInstance<TValues> {
  return new CreateForm<TValues>(options).getFormInstance()
}

export default createForm
