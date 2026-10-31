import { defaultSchemxConfig, defaultSchemxConfigKeys } from "./defaultSchemxConfig"

import type { SchemxConfig } from "./types"
import type { SchemxRendererPropsMap, SchemxSchemaConfig, Values } from "../types"
import type { ValidationAdapterID, ValidationAdapterOption } from "../validator"

// 只过滤已知实例字段，保留声明合并提供的共享扩展。
const instanceOptionKeys = new Set([
  "schemas",
  "initialValues",
  "fieldRules",
  "lifecycleHooks",
  "onRuleError",
  "onFinish",
  "onFinishFailed",
  "onReset",
  "onLoadingChange",
  "onValuesChange",
  "onFieldsChange",
])

/**
 * 合并过程使用的可写配置视图。
 *
 * 函数返回前会收敛为 {@link SchemxConfigSnapshot} 公共契约。
 */
type MutableSchemxConfig<TValues extends Values> = {
  -readonly [TKey in keyof SchemxConfig<TValues>]: SchemxConfig<TValues>[TKey]
}

// Props 对象只冻结一层，内部引用继续保留原有类型。
type ReadonlyRendererPropsMap<TValues extends Values> = {
  readonly [TKey in keyof SchemxRendererPropsMap<TValues>]: Readonly<
    SchemxRendererPropsMap<TValues>[TKey]
  >
}

/**
 * 与合并结果实际冻结层级一致的共享配置快照。
 *
 * @typeParam TValues - 用于关联 Schema 默认值、Renderer Props 与扩展配置的表单值类型。
 */
export interface SchemxConfigSnapshot<TValues extends Values = Values> extends Readonly<
  Omit<SchemxConfig<TValues>, "schemaConfig" | "rendererProps">
> {
  /**
   * 属性被冻结，属性值引用的对象仍保留原有可变语义。
   */
  readonly schemaConfig?: Readonly<Partial<SchemxSchemaConfig<TValues>>>
  /**
   * Map 及每个 Renderer 的 Props 对象被冻结。
   */
  readonly rendererProps?: ReadonlyRendererPropsMap<TValues>
}

/**
 * 嵌套 Schema 配置的合并策略；默认整体替换 Row。
 */
export interface MergeConfigOptions {
  /**
   * Row 整体替换或按属性继承。
   */
  rowMerge?: "replace" | "inherit"
}

// 仅接受配置变参，或配置数组及其合并策略。
type MergeConfigArgs<TValues extends Values> =
  | readonly SchemxConfig<TValues>[]
  | readonly [configs: readonly SchemxConfig<TValues>[], options?: MergeConfigOptions]

/**
 * 补齐默认值后可直接交给 Form Runtime 的 Schemx 配置。
 *
 * @typeParam TValues - 用于关联 Renderer 类型与默认 Props 的表单值类型。
 */
export interface MergedSchemxConfig<TValues extends Values = Values> extends Omit<
  SchemxConfig<TValues>,
  "schemaConfig"
> {
  /**
   * 已合并并补齐 Core 内置默认值的嵌套配置。
   * 适配层扩展项仍可省略；`TValues` 与整体配置保持一致。
   */
  readonly schemaConfig: SchemxSchemaConfig<TValues>
}

/**
 * 按参数顺序从高到低合并共享配置，并返回冻结快照。
 *
 * `schemaConfig` 按属性浅合并，属性值中的数组、对象和函数均由高优先级配置整体
 * 替换并保留原引用。`rendererProps` 按 Renderer key 和 Props 属性浅合并。
 * `validatorAdapters` 在不同配置层之间按 ID 合并，高优先级 adapter 覆盖低优先级
 * 同 ID adapter，并按高到低优先级排列；同一配置层内的重复 ID 仍交由 Validator
 * 按 `override` 规则校验。其他配置项取最高优先级的非 `undefined` 值。
 * 已知实例数据、回调和生命周期字段被过滤；声明合并扩展字段保留。
 * Schema 默认值、Renderer Props、adapter 列表和调度选项复制并冻结受管层级。
 * Registry、组件及其他扩展对象保留引用；不读取全局、不修改输入、不补齐默认值。
 *
 * @typeParam TValues - 用于关联 Renderer 类型与默认 Props 的表单值类型。
 * @param configs - 按优先级从高到低传入的配置列表；第一个参数优先级最高。
 * @returns 过滤实例选项后的共享配置快照。
 *
 * @example
 * const config = mergeConfig(
 *   { schemaConfig: { readonly: true, labelWidth: "120px" } }, // 最高优先级
 *   { schemaConfig: { readonly: false, disabled: true, labelWidth: "80px" } },
 * )
 * // { schemaConfig: { readonly: true, disabled: true, labelWidth: "120px" } }
 *
 * @remarks
 * `schemaConfig` 和单个 Renderer Props 中的显式 `undefined` 会覆盖低优先级同名属性；
 * 顶层配置项的 `undefined` 表示未配置。
 * 如需补齐 Core 内置默认值，请将合并结果传入 {@link resolveSchemxConfig}。
 * 配置层数为 L、参与浅层合并的属性及 adapter 总项数为 K 时，时间与峰值空间均为 O(L + K)。
 */
export function mergeConfig<TValues extends Values = Values>(
  ...configs: readonly SchemxConfig<TValues>[]
): SchemxConfigSnapshot<TValues>
/**
 * 按可选 Row 策略合并配置数组。
 *
 * @typeParam TValues - 用于关联 Schema 默认值、Renderer Props 与扩展配置的表单值类型。
 * @param configs - 按优先级从高到低排列的配置层。
 * @param options - 嵌套 Row 的替换或属性继承策略。
 * @returns 不含库默认值的冻结共享配置。
 *
 * @example
 * const config = mergeConfig([{ schemaConfig: { readonly: true } }])
 */
export function mergeConfig<TValues extends Values = Values>(
  configs: readonly SchemxConfig<TValues>[],
  options?: MergeConfigOptions
): SchemxConfigSnapshot<TValues>
// 将两种调用方式归一化；断言仅用于编译器无法关联的元组分支。
export function mergeConfig<TValues extends Values = Values>(
  ...args: MergeConfigArgs<TValues>
): SchemxConfigSnapshot<TValues> {
  const configs = (
    Array.isArray(args[0]) ? args[0] : args
  ) as readonly SchemxConfig<TValues>[]

  const options = (Array.isArray(args[0]) ? args[1] : undefined) as
    MergeConfigOptions | undefined

  // 所有可写累计对象均由本次调用持有，不修改任何输入。
  const result: MutableSchemxConfig<TValues> = {}

  // Schema 默认值始终保留在嵌套配置中。
  const fieldDefaults: Partial<SchemxSchemaConfig<TValues>> = {}

  // 按低到高收集，合并 adapter 前反转为公共契约要求的优先级。
  const adapterLists: (readonly ValidationAdapterOption[])[] = []

  // inherit 模式下复用独立 Row；显式清除后重新创建。
  let inheritedRow: object | undefined

  // 从最低优先级（从后往前）开始累积，使后续处理的高优先级配置可以覆盖已有值。
  for (let index = configs.length - 1; index >= 0; index -= 1) {
    // 顶层属性只捕获一次，后续读取不再求值调用方的 getter。
    const config = { ...configs[index] }

    if (config.validatorAdapters !== undefined) {
      adapterLists.push(config.validatorAdapters)
    }

    if (config.schemaConfig !== undefined) {
      // Core 不约束适配层 Row 的形状，保留被替换值供首次继承使用。
      const previousRow: unknown = Reflect.get(fieldDefaults, "row")

      Object.assign(fieldDefaults, config.schemaConfig)

      if (
        options?.rowMerge === "inherit" &&
        Object.prototype.propertyIsEnumerable.call(config.schemaConfig, "row")
      ) {
        // 读取复制后的值，避免重复求值输入上的 getter。
        const row: unknown = Reflect.get(fieldDefaults, "row")

        if (row !== null && typeof row === "object") {
          // 只有首次继承需要复制旧值，其后复用本次调用创建的对象。
          const targetRow: object = inheritedRow ?? { ...Object(previousRow) }

          Object.assign(targetRow, row)
          inheritedRow = targetRow
          Reflect.set(fieldDefaults, "row", targetRow)
        } else {
          inheritedRow = undefined
        }
      }

      result.schemaConfig = fieldDefaults
    }

    if (config.rendererProps !== undefined) {
      result.rendererProps ??= {}
      assignRendererProps<TValues>(result.rendererProps, config.rendererProps)
    }

    // 声明合并增加的顶层配置与内置标量遵循相同的优先级，嵌套配置仍使用各自的合并规则。
    for (const [key, value] of Object.entries(config)) {
      if (
        value !== undefined &&
        !instanceOptionKeys.has(key) &&
        key !== "schemaConfig" &&
        key !== "rendererProps" &&
        key !== "validatorAdapters"
      ) {
        Object.assign(result, { [key]: value })
      }
    }
  }

  // 跨层按 ID 合并，同一层的重复项仍交由 Validator 校验。
  const validatorAdapters = mergeValidatorAdapters(...adapterLists.reverse())

  if (validatorAdapters !== undefined) {
    result.validatorAdapters = validatorAdapters
  }

  // 合并结束后仅冻结受管层级，Registry、组件与嵌套引用不递归冻结。
  if (result.validatorAdapters !== undefined) {
    Object.freeze(result.validatorAdapters)
  }

  if (result.schemaConfig !== undefined) {
    Object.freeze(result.schemaConfig)
  }

  if (result.rendererProps !== undefined) {
    // Props 已在合并时新建，此处仅冻结结果，不再复制输入。
    for (const props of Object.values(result.rendererProps)) {
      if (props !== undefined) {
        Object.freeze(props)
      }
    }

    Object.freeze(result.rendererProps)
  }

  if (result.schedulerOptions !== undefined) {
    result.schedulerOptions = Object.freeze({ ...result.schedulerOptions })
  }

  return Object.freeze(result)
}

/**
 * 为单个已合并 Schemx 配置补齐 Schema 内置默认值。
 *
 * 仅补齐嵌套字段默认值，其他配置项保持原值；输入及嵌套配置不会被修改。
 * `schemaConfig` 中缺失或显式为 `undefined` 的字段均回退到 Core 内置默认值。
 *
 * @param config - 已合并或待解析的 Schemx 配置。
 * @returns 可直接供 Runtime 消费的完整配置。
 *
 * @example
 * ```ts
 * const config = resolveSchemxConfig({
 *   schemaConfig: { readonly: true },
 * })
 * ```
 */
export function resolveSchemxConfig<TValues extends Values = Values>(
  config: SchemxConfig<TValues> = {}
): MergedSchemxConfig<TValues> {
  // 尚未补齐默认值的 Schema 配置。
  const schemaConfig = config.schemaConfig ?? {}

  // Runtime 消费的完整 Schema 配置。
  const resolvedSchemaConfig: SchemxSchemaConfig<TValues> = {
    ...defaultSchemxConfig,
    ...schemaConfig,
  }

  // 将缺失或显式 undefined 的字段归一化为内置默认值。
  for (const key of defaultSchemxConfigKeys) {
    Object.assign(resolvedSchemaConfig, {
      [key]: schemaConfig[key] ?? defaultSchemxConfig[key],
    })
  }

  return {
    ...config,
    schemaConfig: resolvedSchemaConfig,
  }
}

/**
 * 将一层 Renderer Props 写入本次合并持有的累计对象。
 *
 * Renderer 之间独立，单个 Renderer 内只做一层属性展开；嵌套对象和数组由高优先级
 * 属性整体替换。显式属性 `undefined` 也会覆盖低优先级同名属性。
 *
 * @typeParam TValues - 用于保持 Renderer key 与 Props 属性的类型关联。
 * @param target - 本次调用独有的低优先级累计结果，允许原地写入。
 * @param source - 当前待应用的高优先级 Renderer Props，不修改其对象。
 */
function assignRendererProps<TValues extends Values>(
  target: SchemxRendererPropsMap<TValues>,
  source: SchemxRendererPropsMap<TValues>
): void {
  // Object.keys 丢失声明键类型，断言仅限此遍历边界。
  for (const type of Object.keys(source) as (keyof SchemxRendererPropsMap<TValues>)[]) {
    // undefined 的整组 Props 表示沿用低优先级配置。
    const props = source[type]

    if (props === undefined) {
      continue
    }

    // 首次创建时复制输入，后续只写入累计结果，且不复用原型上的同名对象。
    const current = Object.hasOwn(target, type) ? target[type] : undefined

    if (current === undefined) {
      Object.assign(target, { [type]: { ...props } })
    } else {
      Object.assign(current, props)
    }
  }
}

/**
 * 按配置优先级合并多个 adapter 注册列表。
 *
 * 参数列表按高到低优先级排列，第一个列表优先级最高；更高优先级列表中已出现的 ID 会屏蔽后续列表中的
 * 同 ID 注册项。同一列表内的重复项会原样保留，使 `createValidationAdapterMap` 仍可
 * 按 `override` 规则校验它们。函数不会修改任何输入列表。
 *
 * @param adapterLists - 按高到低优先级排列的 adapter 注册列表集合；每个元素都可以是
 * 只读或可写数组。
 * @returns 按高到低优先级排列的合并结果；没有传入列表时返回 `undefined`。
 *
 * @example
 * ```ts
 * const adapters = mergeValidatorAdapters(
 *   [formAdapter],
 *   [globalAdapter],
 * )
 * ```
 */
function mergeValidatorAdapters(
  ...adapterLists: readonly (readonly ValidationAdapterOption[])[]
): readonly ValidationAdapterOption[] | undefined {
  // 已被更高优先级列表占用的 adapter ID。
  const higherPriorityIds = new Set<ValidationAdapterID>()

  // 保留同一列表内的原始注册顺序和重复项。
  const mergedAdapters: ValidationAdapterOption[] = []

  for (const adapterList of adapterLists) {
    // 当前列表声明的 ID 在整层处理结束后才参与过滤，以保留列表内重复项。
    const currentIds = new Set<ValidationAdapterID>()

    for (const option of adapterList) {
      // 注册包装对象与 adapter 简写统一映射到 adapter ID。
      const id = "adapter" in option ? option.adapter.id : option.id

      if (!higherPriorityIds.has(id)) {
        mergedAdapters.push(option)
      }

      currentIds.add(id)
    }

    for (const id of currentIds) {
      higherPriorityIds.add(id)
    }
  }

  return adapterLists.length === 0 ? undefined : mergedAdapters
}
