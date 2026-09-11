/**
 * 表单实例工厂 - 框架无关的核心装配入口。
 *
 * `createForm` 负责解析配置并装配 FormModel、SchemaRuntime
 * 与稳定的 SchemxInstance。
 *
 * @module core/createForm
 */

import { createSchemas, isSchemxSchemas } from "./createSchemas"
import { createFormApi, createFormInstance } from "./form/instance"
import { createFormModel } from "./form/model"
import { createFormObserver } from "./form/observer"
import { type CreateFormOptions, mergeCreateFormOptions } from "./form/options"
import { createPresetRuleRegistry, createRendererRegistry } from "./registry"
import { createSchemaRuntime } from "./runtime/createSchemaRuntime"

import type { SchemaRuntime } from "./runtime/createSchemaRuntime"
import type {
  SchemxFormApi,
  SchemxInstance,
  SchemxSchemaValues,
  SchemxValuesHint,
  Values,
} from "./types"

type IsAny<TValue> = 0 extends 1 & TValue ? true : false

type SchemaInputWithValues<TSchema> = [SchemxSchemaValues<TSchema>] extends [never]
  ? never
  : IsAny<SchemxSchemaValues<TSchema>> extends true
    ? never
    : TSchema

type InferredSchemaValues<TSchema> = SchemxSchemaValues<TSchema> extends infer TValues extends Values
  ? TValues
  : Values

type NonAny<TValues extends Values> = IsAny<TValues> extends true ? never : TValues

type AnyOnly<TValues extends Values> = IsAny<TValues> extends true ? TValues : never

type UnmarkedSchema =
  | {
      readonly name: string
      readonly label: string
      readonly componentType: string
      readonly [key: string]: unknown
    }
  | {
      readonly label: string
      readonly children: readonly unknown[]
      readonly [key: string]: unknown
    }
  | {
      readonly to: readonly string[]
      readonly renderer: (
        values: Values,
        form: SchemxFormApi<Values>,
        context: unknown
      ) => readonly unknown[] | Promise<readonly unknown[]>
    }
  | {
      readonly key: string
      readonly name: string
      readonly item: readonly unknown[]
    }

type UnmarkedSchemaInput = UnmarkedSchema & SchemxValuesHint<never>

/**
 * 内联 Schema 的轻量上下文。
 *
 * 当 TValues 由 initialValues 推导时，字段名还没有形成可供公共 Schema 展开的
 * 固定联合，因此这里只为常见规则和容器结构提供有限上下文；已声明的
 * `SchemxField<TValues>[]` 仍由精确重载处理。
 */
type InlineRule = {
  asyncValidator: (
    rule: any,
    value: any,
    callback: any,
    source: any,
    options: any
  ) => any
}

type AsyncAwareSchema = {
  readonly name?: string
  readonly label?: string
  readonly componentType?: string
  readonly rules?: readonly InlineRule[]
  readonly [key: string]: unknown
}

type AsyncAwareCreateFormOptions = Omit<LooseCreateFormOptions, "schemas"> & {
  initialValues: Values
  schemas?: readonly AsyncAwareSchema[]
}

type InlineSchema<TValues extends Values> = {
  readonly key?: string
  readonly name?: string
  readonly label?: string
  readonly componentType?: string
  readonly initialValue?: unknown
  readonly required?: unknown
  readonly rules?: readonly InlineRule[]
  readonly dependencies?: unknown
  readonly onChange?: (value: unknown, form: SchemxInstance<TValues>) => void
  readonly children?: readonly unknown[]
  readonly to?: readonly string[]
  readonly renderer?: (
    values: TValues,
    form: SchemxFormApi<TValues>,
    context: unknown
  ) => readonly unknown[] | Promise<readonly unknown[]>
  readonly item?: readonly unknown[]
  readonly [key: string]: unknown
}

type InferredCreateFormOptions<TValues extends Values> = Omit<
  LooseCreateFormOptions,
  | "schemas"
  | "onRuleError"
  | "onFinish"
  | "onFinishFailed"
  | "onReset"
  | "onLoadingChange"
  | "onValuesChange"
  | "onFieldsChange"
  | "lifecycleHooks"
> & {
  initialValues: TValues & NonAny<TValues>
  schemas?: readonly InlineSchema<TValues>[]
  fieldRules?: CreateFormOptions<TValues>["fieldRules"]
  onRuleError?: CreateFormOptions<TValues>["onRuleError"]
  onFinish?: CreateFormOptions<TValues>["onFinish"]
  onFinishFailed?: CreateFormOptions<TValues>["onFinishFailed"]
  onReset?: CreateFormOptions<TValues>["onReset"]
  onLoadingChange?: CreateFormOptions<TValues>["onLoadingChange"]
  onValuesChange?: CreateFormOptions<TValues>["onValuesChange"]
  onFieldsChange?: CreateFormOptions<TValues>["onFieldsChange"]
  lifecycleHooks?: CreateFormOptions<TValues>["lifecycleHooks"]
}

/**
 * 没有表单值来源时使用的轻量配置上下文。
 *
 * 这里不展开完整的公共泛型配置，避免一个无类型的内联 Schema 触发所有字段路径的
 * 联合计算；显式表单值或 initialValues 会改用精确重载。
 */
interface LooseCreateFormOptions {
  schemas?: readonly UnmarkedSchemaInput[]
  schemaConfig?: unknown
  fieldRules?: unknown
  rendererProps?: unknown
  rendererRegistry?: unknown
  defaultRendererType?: string
  presetRuleRegistry?: unknown
  validatorAdapters?: readonly unknown[]
  onRuleError?: unknown
  onFinish?: (...args: never[]) => unknown
  onFinishFailed?: unknown
  onReset?: unknown
  onLoadingChange?: unknown
  onValuesChange?: (
    changedValues: Readonly<Partial<Values>>,
    latestSnapshot: Readonly<Values> | Values
  ) => void
  onFieldsChange?: unknown
  lifecycleHooks?: unknown
  debug?: boolean
  schedulerOptions?: unknown
  validationConcurrency?: number
}

type ExplicitNoInitialFormOptions<TValues extends Values> = Omit<
  LooseCreateFormOptions,
  "schemas"
> & {
  schemas?: readonly unknown[]
} & (IsAny<TValues> extends true ? never : unknown)

export type {
  CreateFormOptions,
  ResolvedCreateFormOptions,
  FormCallbackOptions,
  FormLifecycleOptions,
  FormPerformanceOptions,
  FormRegistryOptions,
  FormSchemaOptions,
} from "./form/options"

/**
 * 创建 Schemx 表单实例。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - 表单 Schema、初始值和生命周期回调配置。
 * @returns 可用于读取、更新、校验和销毁表单的稳定实例。
 *
 * @remarks
 * 创建过程会装配 Model、Runtime 和 Instance；初始化失败时会释放已创建资源并重新抛出原始错误。
 *
 */
/** 没有显式表单值来源时使用宽 Schema 上下文，保持普通内联写法可用。 */
export function createForm(
  options?: LooseCreateFormOptions
): SchemxInstance<Values>

export function createForm(options: AsyncAwareCreateFormOptions): SchemxInstance<Values>

export function createForm<TValues extends Values>(
  options: InferredCreateFormOptions<TValues>
): SchemxInstance<TValues>

/** 显式指定表单值类型时使用精确 Schema 上下文。 */
export function createForm<TValues extends Values>(): SchemxInstance<TValues>

export function createForm<TValues extends Values>(
  options: ExplicitNoInitialFormOptions<TValues>
): SchemxInstance<TValues>

/** any 初始值不能提供稳定的字段结构，回退到 Values 上下文。 */
export function createForm(
  options: LooseCreateFormOptions & {
    initialValues: Values
    onValuesChange?: (
      changedValues: Readonly<Partial<Values>>,
      latestSnapshot: Readonly<Values> | Values
    ) => void
  }
): SchemxInstance<Values>

export function createForm<TValues extends Values>(
  options: unknown = {}
): SchemxInstance<TValues> {
  // 所有 Form 子系统共享的标准化配置。
  const merged = mergeCreateFormOptions(options as CreateFormOptions<TValues>)

  const presetRuleRegistry = merged.presetRuleRegistry ?? createPresetRuleRegistry()

  const rendererRegistry =
    merged.rendererRegistry ?? createRendererRegistry(merged.defaultRendererType)

  // Form 统一持有 Schema source，Runtime 仅订阅并协调其变化。
  const schemas = isSchemxSchemas(merged.schemas)
    ? merged.schemas
    : createSchemas<TValues>(merged.schemas ?? [])

  // Form 持有的状态、值存储和校验模型。
  const model = createFormModel<TValues>({
    initialValues: merged.initialValues ?? ({} as TValues),
    presetRuleRegistry,
    validatorAdapters: [...(merged.validatorAdapters ?? [])],
    onRuleError: merged.onRuleError,
    validationConcurrency: merged.validationConcurrency,
  })

  // 防止销毁回调被重复执行。
  let disposed = false

  // 初始 Runtime 挂载成功后才会赋值的观察器清理函数。
  let disposeObserver = () => {}

  // 当前 Form 连接的 Runtime；销毁后释放，使公开 API 不再触达内部实现。
  let runtime: SchemaRuntime<TValues> | undefined

  const destroy = (): void => {
    if (disposed) {
      return
    }

    disposed = true
    disposeObserver()
    runtime?.dispose()
    model.dispose()
    runtime = undefined
  }

  // 先组装公开实例；Runtime 引用会在下一步赋值。
  const instance = createFormInstance({
    model,
    getRuntime: () => runtime,
    getSchemas: () => (disposed ? undefined : schemas),
    callbacks: {
      onFinish: merged.onFinish,
      onFinishFailed: merged.onFinishFailed,
      onReset: merged.onReset,
      onLoadingChange: merged.onLoadingChange,
    },
    destroy,
    rendererRegistry,
    presetRuleRegistry,
  })

  // 传递给动态渲染器实现的轻量 API；直接复用公开实例能力。
  const formApi = createFormApi(instance)

  // 负责编译并协调当前 Schema 的 Runtime。
  runtime = createSchemaRuntime({
    schemas,
    store: model.store,
    validation: model.validation,
    instance,
    formApi,
    schemaConfig: merged.schemaConfig,
    fieldRules: merged.fieldRules,
    rendererProps: merged.rendererProps,
    lifecycleHooks: merged.lifecycleHooks,
    debug: merged.debug,
    schedulerOptions: merged.schedulerOptions,
  })

  try {
    runtime.mount()
    disposeObserver = createFormObserver(model, {
      onValuesChange: merged.onValuesChange,
      onFieldsChange: merged.onFieldsChange,
    })
  } catch (error) {
    destroy()
    throw error
  }

  return instance
}

export default createForm
