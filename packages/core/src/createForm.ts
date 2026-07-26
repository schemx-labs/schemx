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
 * if (result.valid) {
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
 *     console.log('校验失败:', error)
 *   }
 * })
 *
 * // 使用 effect 监听值变化
 * const dispose = form.effect(() => {
 *   console.log('当前值:', form.getFieldsValue())
 *   console.log('错误:', form.getFieldErrors('email'))
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

import { createCompile } from "./compiler"
import { resolveFormConfig } from "./config/schemxConfig"
import {
  createSchemas,
  isSchemxSchemas,
  type SchemxSchemas,
  type SchemxSchemasInput,
} from "./createSchemas"
import { defaultConfigKey, resolveDefaultConfig } from "./defaultConfig"
import {
  createLifecycleBus,
  type LifecycleBus,
  type SchemxLifecycleHooks,
} from "./lifecycle/lifecycle"
import {
  type ContainerRuntimeNode,
  createScope,
  type RootRuntimeNode,
  type RuntimeNode,
  type RuntimeNodeResourceContext,
  type Scope,
} from "./node"
import { createRuntimeResources } from "./node/resources"
import { batchUpdates, createSignalEffect } from "./reactivity"
import { createReconciler, type Reconciler } from "./reconciler"
import {
  createRendererRegistry,
  createValidationRuleRegistry,
  type RendererRegistry,
  type ValidationRuleRegistry,
} from "./registry"
import { createScheduler, type Scheduler } from "./scheduler"
import { type SchemxContext } from "./schemxContext"
import { createStore, type Store } from "./store"
import { collectObjectPathsByLeaf, diff, withLock } from "./utils"
import {
  createValidationController,
  createValidator,
  type CreateValidatorOptions,
  type FieldValidationConfig,
  type ValidationAdapterOption,
  type ValidationController,
  type ValidationFailure,
  type ValidationResult,
  type Validator,
} from "./validator"
import { type SchemxViewSchema, subscribeViewSchemas } from "./view"
import { createRootRuntimeViewState } from "./view/createViewState"

import type { Compile } from "./compiler/types"
import type { FormDescriptor } from "./descriptor"
import type {
  NamePath,
  SchemxBaseField,
  SchemxDefaultProps,
  SchemxField,
  SchemxFieldSchemaPatch,
  SchemxFormApi,
  SchemxInstance,
  SchemxRendererKey,
  Values,
} from "./types"
import type { FieldRules } from "./types/rule"

type Callbacks<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = Pick<
  CreateFormOptions<TValues, TName>,
  "onValuesChange" | "onFinish" | "onFinishFailed" | "onFieldsChange"
>

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
 *   onValuesChange: (changedValues, latestValues) => {
 *     console.log(changedValues, latestValues)
 *   },
 *   onFinish: (values) => {},
 *   onFinishFailed: ({ errors, values }) => {
 *     console.log(errors, values)
 *   },
 *   onFieldsChange: (changedFields, allFields) => {
 *     console.log(changedFields, allFields)
 *   }
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
  rendererRegistry?: RendererRegistry
  /**
   * 字段未指定 `componentType` 时使用的默认渲染器类型。
   */
  defaultRendererType?: SchemxRendererKey
  /**
   * 当前 form 实例使用的规则注册表。
   */
  validationRuleRegistry?: ValidationRuleRegistry
  /**
   * 当前 Form 额外注册的校验 adapter。
   *
   * Standard Schema 由唯一内置 adapter 支持；原生 `ValidationRule` 是 Core 基础规则，
   * 二者均无需在此注册。
   */
  validatorAdapters?: readonly ValidationAdapterOption[]

  /**
   * 将规则执行异常转换为字段错误消息。
   *
   * @param error - 规则执行时抛出的原始异常。
   * @param context - 发生异常的字段校验上下文。
   * @returns 写入字段错误状态的消息。
   */
  onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]

  /**
   * submit 校验通过后执行；返回 Promise 时，submit 会等待其完成。
   *
   * @param values - 本次校验通过的只读表单值。
   * @returns 可选的异步完成信号。
   */
  onFinish?: (values: Readonly<TValues>) => void | Promise<void>
  /**
   * submit 校验失败后的回调。
   *
   * @param failure - 包含表单值与全部校验错误的失败结果。
   */
  onFinishFailed?: (failure: ValidationFailure<TValues>) => void
  /**
   * 字段值变化后的回调，接收本次变化片段和最新快照。
   *
   * @param changedValues - 本次变化的字段值片段。
   * @param latestSnapshot - 变化后的完整表单值视图。
   */
  onValuesChange?: (
    changedValues: Readonly<Partial<TValues>>,
    latestSnapshot: Readonly<TValues> | TValues
  ) => void
  /**
   * 字段路径变化后的回调，接收本次变化路径和所有已知字段路径。
   *
   * @param changedFields - 本次发生变化的字段路径。
   * @param allFields - 当前所有已知字段路径。
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
  private context: SchemxContext<TValues>

  /** 用户传入的表单级回调集合 */
  readonly callbacks: Callbacks<TValues>

  /** 表单状态存储，管理字段值、初始值和订阅 */
  private store: Store<TValues>

  /** 渲染器注册表，解析 schema.componentType 到具体渲染实现 */
  readonly rendererRegistry: RendererRegistry

  /** 校验规则注册表，解析字符串规则名称到 StandardSchema 或规则工厂 */
  readonly validationRuleRegistry: ValidationRuleRegistry

  /** 字段校验器，维护规则、错误状态和校验执行流程 */
  readonly validator: Validator<TValues>

  /** 字段规则归一化与注册控制器。 */
  readonly validationController: ValidationController<TValues>

  /** Runtime node 的透明根节点，承载所有编译后的表单描述符节点 */
  readonly root: RootRuntimeNode<TValues>

  /** 运行时异步调度器，用于追踪 dependency renderer 和字段动态依赖 */
  readonly scheduler: Scheduler

  /** descriptor 到 RuntimeNode tree 的协调器，负责创建、复用和销毁节点 */
  readonly reconciler: Reconciler<TValues>

  /** RuntimeNode 之外的 descriptor、state、view 和 effect 资源表 */
  readonly nodeResources: RuntimeNodeResourceContext<TValues>

  /** 表单级资源作用域，统一管理回调 effect 等非 RuntimeNode 资源 */
  private readonly scope: Scope = createScope()

  /** root schema 的统一数据源 */
  private schemas: SchemxSchemas<TValues>

  /** schema 编译，让未变化的 schema 复用 descriptor 引用 */
  private compile: Compile<TValues>

  /** 标记表单实例是否已销毁，保证 dispose 幂等 */
  private disposed = false

  /** node 生命周期事件总线，连接 reconciler 与字段资源挂载流程 */
  private lifecycleBus: LifecycleBus<RuntimeNode<TValues>>

  /**
   * 创建表单实例。
   *
   * 解析 options 并装配各子系统：统一保存用户回调、隔离 validator/renderer 注册表、
   * 处理 modelValue 优先级、共享 defaultProps 引用、统一 schema source，
   * 创建 compile/scheduler/view state/lifecycle bus 与 root runtime node。
   *
   * @param options - 表单配置选项
   */
  constructor(options: CreateFormOptions<TValues> = {}) {
    const {
      schemas: schemasInput,
      initialValues = {} as TValues,
      modelValue,
      rendererRegistry,
      defaultRendererType,
      validationRuleRegistry,
      validatorAdapters: formValidatorAdapters,
      onRuleError,
      ...restOptions
    } = options

    // 统一保存用户回调，后续 effect 和 submit 流程从同一入口读取。
    this.callbacks = {
      onValuesChange: options.onValuesChange,
      onFinish: options.onFinish,
      onFinishFailed: options.onFinishFailed,
      onFieldsChange: options.onFieldsChange,
    }

    // 一次性解析内置、全局与 Form 实例配置，后续装配不再重复表达优先级。
    const resolvedConfig = resolveFormConfig({
      defaultProps: pick(restOptions, defaultConfigKey),
      defaultRendererType,
      rendererRegistry,
      validationRuleRegistry,
    })

    // 注册表允许外部注入；未注入时回退全局共享注册表，再缺省时创建表单实例私有注册表，
    // 避免跨实例污染。全局共享注册表为 opt-in：configureSchemx 设置后副作用跨实例传播。
    this.rendererRegistry =
      resolvedConfig.rendererRegistry ??
      createRendererRegistry(resolvedConfig.defaultRendererType)

    this.validationRuleRegistry =
      resolvedConfig.validationRuleRegistry ?? createValidationRuleRegistry()

    this.validator = createValidator<TValues>({ onRuleError })

    this.validationController = createValidationController({
      validator: this.validator,
      registry: this.validationRuleRegistry,
      validatorAdapters: [
        ...resolvedConfig.validation.validatorAdapters,
        ...(formValidatorAdapters ?? []),
      ],
    })

    // modelValue 优先覆盖 initialValues，用于受控场景的初始快照对齐。
    this.store = createStore<TValues>({
      initialValues: { ...initialValues, ...(modelValue ?? {}) },
    })

    // RuntimeNode 之外的 descriptor、state、view 和 effect 资源表
    this.nodeResources = createRuntimeResources<TValues>()

    // 生命周期总线连接 node 结构变化与字段模型、依赖资源的挂载和更新流程。
    this.lifecycleBus = createLifecycleBus<RuntimeNode<TValues>>()

    // 初始化运行时 node 所需的核心基础设施。
    this.scheduler = createScheduler()

    // defaultProps 必须在 compiler options 与 context 间共享同一引用：
    // applySchemas 走 compiler fallback 时读取的是 compileOptions.defaultProps，
    // updateDefaultProps 直接 mutate context.defaultProps，若两者是不同对象，
    // 变更将无法被编译器感知，reconcile 后字段值不变、effect 也不会重算。
    const defaultProps = resolvedConfig.defaultProps

    this.compile = createCompile({
      defaultProps,
      defaultRendererType: resolvedConfig.defaultRendererType,
      formInstance: this.getFormInstance(),
    })

    // dependency renderer 运行时需要回写 node，因此上下文在首次编译前准备好。
    this.context = {
      defaultProps,
      instance: this.getFormInstance(),
      formApi: this.getFormApi(),
      compile: this.compile,
      scheduler: this.scheduler,
      validation: this.validationController,
      lifecycleBus: this.lifecycleBus,
      nodeResources: this.nodeResources,
      commitChildren: this.commitChildren,
    }

    this.reconciler = createReconciler<TValues>(this.context)

    this.root = this.reconciler.createRoot()

    createRootRuntimeViewState(this.root, this.nodeResources)

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
      getFieldErrors: this.validator.getFieldErrors.bind(this.validator),
      setFieldErrors: this.validator.setFieldErrors.bind(this.validator),
      clearFieldErrors: this.validator.clearFieldErrors.bind(this.validator),
      resetFields: this.store.resetFields.bind(this.store),
      reset: this.reset.bind(this),
      submit: this.submit.bind(this),

      setFieldRules: this.setFieldRules.bind(this),
      removeFieldRules: this.removeFieldRules.bind(this),

      effect: this.effect.bind(this),
      batch: this.batch.bind(this),

      setSchemas: this.setSchemas.bind(this),
      updateSchemas: this.updateSchemas.bind(this),
      updateFieldSchema: this.updateFieldSchema.bind(this),
      updateDefaultProps: this.updateDefaultProps.bind(this),
      getViewSchemas: this.getViewSchemas.bind(this),
      subscribeViewSchemas: this.subscribeViewSchemas.bind(this),
      waitForDependencies: this.waitForIdle.bind(this),

      getRenderer: this.rendererRegistry.resolve.bind(this.rendererRegistry),
      registerRenderer: this.rendererRegistry.register.bind(this.rendererRegistry),
      hasRenderer: this.rendererRegistry.has.bind(this.rendererRegistry),

      getRule: this.validationRuleRegistry.get.bind(
        this.validationRuleRegistry
      ) as SchemxInstance<TValues>["getRule"],
      registerRule: this.validationRuleRegistry.register.bind(
        this.validationRuleRegistry
      ) as SchemxInstance<TValues>["registerRule"],
      hasRule: this.validationRuleRegistry.has.bind(this.validationRuleRegistry),

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
      getErrors: this.validator.getFieldErrors.bind(this.validator),
      setErrors: this.validator.setFieldErrors.bind(this.validator),
      clearErrors: this.validator.clearFieldErrors.bind(this.validator),
      resetFields: this.store.resetFields.bind(this.store),
      reset: this.reset.bind(this),
      validateField: this.validateField.bind(this),
      validate: this.validate.bind(this),
    }
  }

  /**
   * 注册字段校验规则
   */
  private setFieldRules<TName extends NamePath<TValues>>(
    path: TName,
    rules: FieldRules<TValues, TName>
  ): void {
    const node = this.nodeResources.fieldIndex.getByName(path)

    const effective = node?.fieldState?.effectiveSchema.value

    const config: FieldValidationConfig<TValues, TName> = {
      name: path,
      label: effective?.label ?? "",
      required: (effective?.required ?? false) as FieldValidationConfig<
        TValues,
        TName
      >["required"],
      rules,
    }

    this.validationController.syncField(config)
    // 覆盖尚未执行的字段 effect 任务，避免初始化规则在下一微任务回写旧 schema。
    this.scheduler.schedule({
      id: `validation:${String(path)}`,
      priority: "post",
      scope: this.scope,
      run: () => {
        this.validationController.syncField(config)
      },
    })
  }

  /**
   * 移除字段校验规则。
   */
  private removeFieldRules<TName extends NamePath<TValues>>(path: TName): void {
    this.validationController.removeField(path)
    this.scheduler.schedule({
      id: `validation:${String(path)}`,
      priority: "post",
      scope: this.scope,
      run: () => this.validationController.removeField(path),
    })
  }

  /**
   * 校验指定字段
   */
  private async validateField<TName extends NamePath<TValues>>(
    name: TName
  ): Promise<ValidationResult<TValues, TName>> {
    await this.waitForIdle()
    const result = await this.validator.validateField(name, this.store.getFieldsValue())

    return result
  }

  /**
   * 校验所有已注册字段
   *
   * 校验前检查是否有字段处于操作中状态，有则直接返回失败结果。
   */
  private validate = withLock(async (): Promise<ValidationResult<TValues>> => {
    const depsReady = await this.waitForIdle()

    if (!depsReady) {
      return {
        valid: false,
        values: this.store.getFieldsSnapshot(),
        errors: [
          {
            scope: "form",
            issues: [
              { message: "表单依赖解析超时，请稍后重试", code: "dependency_timeout" },
            ],
          },
        ],
      }
    }

    const pendingFields = this.store.getPendingFields()

    if (pendingFields.length > 0) {
      const defaultMessage = `存在正在操作中的字段: ${pendingFields.map((i) => i.field).join(", ")}，请等待完成后再提交`

      console.warn(`[schemx] ${defaultMessage}`)

      return {
        valid: false,
        values: this.store.getFieldsSnapshot(),
        errors: pendingFields.map(({ field, message }) => {
          const messages = message.length ? message : ["字段正在处理中，请稍后重试"]

          this.validator.setFieldErrors(field as NamePath<TValues>, messages)

          return {
            scope: "field" as const,
            name: field as NamePath<TValues>,
            issues: messages.map((message) => ({ message, code: "pending" })) as [
              { message: string; code: string },
              ...{ message: string; code: string }[],
            ],
          }
        }),
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
    this.validator.clearErrors()
  }

  /**
   * 提交表单
   */
  private submit = withLock(async (): Promise<ValidationResult<TValues>> => {
    // 等待依赖解析完成
    const depsReady = await this.waitForIdle()

    if (!depsReady) {
      return {
        valid: false,
        values: this.store.getFieldsSnapshot(),
        errors: [
          {
            scope: "form",
            issues: [
              { message: "表单依赖解析超时，请稍后重试", code: "dependency_timeout" },
            ],
          },
        ],
      }
    }

    const result = await this.validate()

    if (result.valid) {
      await this.callbacks.onFinish?.(result.values)
    } else if (!result.cancelled) {
      this.callbacks.onFinishFailed?.(result)
    }

    return result
  })

  /**
   * 创建 reactive effect。
   *
   * 回调内调用 getFieldValue / getFieldErrors 时自动追踪依赖，
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
   * 更新单个字段的静态 schema 呈现配置。
   */
  private updateFieldSchema(
    name: NamePath<TValues>,
    patch: SchemxFieldSchemaPatch<TValues>
  ): void {
    if (this.disposed) {
      return
    }

    const node = this.nodeResources.fieldIndex.getByName(name)

    if (!node) {
      return
    }

    const current = node.descriptor ?? undefined

    if (current?.type !== "field") {
      return
    }

    const componentProps = patch.componentProps
      ? {
          ...current.staticSchema.componentProps,
          ...patch.componentProps,
        }
      : current.staticSchema.componentProps

    const nextRawSchema: SchemxBaseField<TValues> = {
      ...current.staticSchema,
      ...patch,
      componentProps,
      key: current.key,
      name: current.name,
      componentType: current.staticSchema.componentType,
      dependencies: current.dynamicProps?.dependencies,
    }

    const [next] = this.compile.toDescriptors([nextRawSchema])

    if (next.type !== "field") {
      return
    }

    this.reconciler.updateNode(node, next)
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

    Object.assign(
      this.context.defaultProps,
      resolveDefaultConfig(this.context.defaultProps, pick(partial, defaultConfigKey))
    )

    // defaultProps 影响所有字段的 normalizedSchema，bump version 让缓存条目失效。
    this.compile.invalidate()

    this.applySchemas(this.schemas.peek())
  }

  /**
   * 将 schema source 的当前值提交到 runtime node。
   */
  private applySchemas(schemas: readonly SchemxField<TValues>[]): void {
    if (this.disposed) {
      return
    }

    const descriptors = this.compile.toDescriptors(schemas)

    this.commitChildren(this.root as ContainerRuntimeNode<TValues>, descriptors)
  }

  /**
   * 唯一子节点提交边界。
   *
   * 所有结构输入先编译成 descriptor，再经由这里提交到某个 parent RuntimeNode。
   * Reconciler 只负责 node 结构；视图层通过 childrenState signal 自动感知结构变化。
   */
  private commitChildren = (
    parentNode: ContainerRuntimeNode<TValues>,
    descriptors: FormDescriptor<TValues>[]
  ): void => {
    this.reconciler.reconcileChildren(parentNode, descriptors)
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
    this.reconciler.removeNode(this.root)
    this.scheduler.dispose()
    this.validationController.destroy()
    this.validator.destroy()
    this.store.destroy()
  }

  /**
   * 获取当前 ViewSchemas。
   */
  private getViewSchemas(): readonly SchemxViewSchema<TValues>[] {
    const rootViewState = this.root.viewState

    if (!rootViewState || !("viewSchemas" in rootViewState)) {
      return []
    }

    return rootViewState.viewSchemas.value
  }

  /**
   * 订阅 ViewSchemas 变化。
   */
  private subscribeViewSchemas(
    callback: (schemas: readonly SchemxViewSchema<TValues>[]) => void
  ): () => void {
    return subscribeViewSchemas<TValues>(this.root, this.nodeResources, callback)
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
