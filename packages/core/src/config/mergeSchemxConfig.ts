import { mergeValidatorAdapters } from "../validator/adapters"

import { defaultSchemxConfig, defaultSchemxConfigKeys } from "./defaultSchemxConfig"

import type { CreateSchemxOptions } from "./schemxOptions"
import type { SchemxRendererPropsMap, SchemxSchemaConfig, Values } from "../types"
import type { ValidationAdapterOption } from "../validator/types"

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
 * 函数返回前会再次收敛为只读的 {@link CreateSchemxOptions} 公共契约。
 */
type MutableSchemxConfig<TValues extends Values> = {
  -readonly [
    TKey in keyof CreateSchemxOptions<TValues>
  ]: CreateSchemxOptions<TValues>[TKey]
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

/**
 * 补齐默认值后可直接交给 Form Runtime 的 Schemx 配置。
 *
 * @typeParam TValues - 用于关联 Renderer 类型与默认 Props 的表单值类型。
 */
export interface MergedSchemxConfig<TValues extends Values = Values> extends Omit<
  CreateSchemxOptions<TValues>,
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
 * 如需补齐 Core 内置默认值，请使用 {@link resolveSchemxConfig}；如需一步完成，
 * 请使用 {@link mergeAndResolveSchemxConfig}。
 */
export function mergeConfig<TValues extends Values = Values>(
  ...configs: readonly CreateSchemxOptions<TValues>[]
): Readonly<CreateSchemxOptions<TValues>>
/**
 * 按可选 Row 策略合并配置数组。
 *
 * @param configs - 按优先级从高到低排列的配置层。
 * @param options - 嵌套 Row 的替换或属性继承策略。
 * @returns 不含库默认值的冻结共享配置。
 *
 * @example
 * const config = mergeConfig([{ schemaConfig: { readonly: true } }])
 */
export function mergeConfig<TValues extends Values = Values>(
  configs: readonly CreateSchemxOptions<TValues>[],
  options?: MergeConfigOptions
): Readonly<CreateSchemxOptions<TValues>>
export function mergeConfig<TValues extends Values = Values>(
  ...args: readonly (
    | CreateSchemxOptions<TValues>
    | readonly CreateSchemxOptions<TValues>[]
    | MergeConfigOptions
    | undefined
  )[]
): Readonly<CreateSchemxOptions<TValues>> {
  const configs = (
    Array.isArray(args[0]) ? args[0] : args
  ) as readonly CreateSchemxOptions<TValues>[]

  const options = (Array.isArray(args[0]) ? args[1] : undefined) as
    | MergeConfigOptions
    | undefined

  const result: MutableSchemxConfig<TValues> = {}

  // Schema 默认值始终保留在嵌套配置中。
  const fieldDefaults: Record<string, unknown> = {}

  let hasSchemaConfig = false

  // 从最低优先级（从后往前）开始累积，使后续处理的高优先级配置可以覆盖已有值。
  for (let index = configs.length - 1; index >= 0; index -= 1) {
    // 当前正在合并的一层配置。
    const config = configs[index]

    hasSchemaConfig ||= config.schemaConfig !== undefined
    const defaults: Record<string, unknown> = { ...config.schemaConfig }

    if (options?.rowMerge === "inherit" && Object.hasOwn(defaults, "row")) {
      const row = defaults.row

      if (row !== undefined && typeof row === "object" && row !== null) {
        defaults.row = { ...Object(fieldDefaults.row), ...row }
      }
    }

    Object.assign(fieldDefaults, defaults)

    if (config.rendererProps !== undefined) {
      result.rendererProps = mergeRendererProps(
        result.rendererProps,
        config.rendererProps
      )
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

  // 收集按高到低优先级排列的 adapter 列表，交由 Validator adapter 工具按 ID 合并。
  const adapterLists: (readonly ValidationAdapterOption[])[] = []

  for (const config of configs) {
    if (config.validatorAdapters !== undefined) {
      adapterLists.push(config.validatorAdapters)
    }
  }

  const validatorAdapters = mergeValidatorAdapters(...adapterLists)

  if (validatorAdapters !== undefined) {
    result.validatorAdapters = Object.freeze(validatorAdapters)
  }

  if (hasSchemaConfig) {
    result.schemaConfig = Object.freeze(fieldDefaults) as Partial<
      SchemxSchemaConfig<TValues>
    >
  }

  if (result.rendererProps !== undefined) {
    // Props 已在合并时新建，此处仅冻结结果，不再复制输入。
    for (const props of Object.values(result.rendererProps)) {
      if (props !== undefined) {
        Object.freeze(props)
      }
    }

    result.rendererProps = Object.freeze(result.rendererProps)
  }

  if (result.schedulerOptions !== undefined) {
    result.schedulerOptions = Object.freeze({ ...result.schedulerOptions })
  }

  return Object.freeze(result)
}

/**
 * {@link mergeConfig} 的兼容名称。
 *
 * @deprecated 请改用 {@link mergeConfig}。
 * @param configs - 按优先级从高到低传入的配置列表。
 *
 * @example
 * ```ts
 * const config = mergeSchemxConfig(
 *   { schemaConfig: { readonly: true } },
 *   { schemaConfig: { readonly: false, disabled: true } },
 * )
 * ```
 */
export const mergeSchemxConfig: typeof mergeConfig = mergeConfig

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
  config: CreateSchemxOptions<TValues> = {}
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
 * 按优先级合并多个 Schemx 配置并补齐 Schema 内置默认值。
 *
 * 这是 {@link mergeConfig} 与 {@link resolveSchemxConfig} 的便捷组合，
 * 适用于需要立即交给 Form Runtime 消费的场景。
 *
 * @param configs - 按高到低优先级传入的配置列表。
 * @returns 合并且补齐默认值后的完整配置。
 *
 * @example
 * ```ts
 * const config = mergeAndResolveSchemxConfig(
 *   { schemaConfig: { readonly: true } },
 *   { schemaConfig: { disabled: true } },
 * )
 * ```
 */
export function mergeAndResolveSchemxConfig<TValues extends Values = Values>(
  ...configs: readonly CreateSchemxOptions<TValues>[]
): MergedSchemxConfig<TValues> {
  // 先保留所有层级的显式值，再在最后统一回退到内置默认值。
  const mergedConfig = mergeConfig(...configs)

  return resolveSchemxConfig(mergedConfig)
}

/**
 * 合并两层 Renderer Props。
 *
 * Renderer 之间独立，单个 Renderer 内只做一层属性展开；嵌套对象和数组由高优先级
 * 属性整体替换。显式属性 `undefined` 也会覆盖低优先级同名属性。
 *
 * @param lowerPriority - 已合并的低优先级 Renderer Props。
 * @param higherPriority - 当前待应用的高优先级 Renderer Props。
 * @returns 新建的 Renderer Props Map，不修改任一输入对象。
 */
function mergeRendererProps<TValues extends Values>(
  lowerPriority: SchemxRendererPropsMap<TValues> | undefined,
  higherPriority: SchemxRendererPropsMap<TValues>
): SchemxRendererPropsMap<TValues> {
  // 运行时只处理普通字符串 key 与 Props 记录，类型关联已在公开 Map 类型中约束。
  type RendererPropsRecord = Record<string, Record<string, unknown> | undefined>

  // 将缺失的低优先级配置视为空 Map。
  const lowerPriorityRecord = (lowerPriority ?? {}) as RendererPropsRecord

  // 转为统一的运行时记录形态，以便按 key 遍历。
  const higherPriorityRecord = higherPriority as RendererPropsRecord

  // 先复制 Map 外层，使未被高优先级触及的 Renderer 直接继承。
  const mergedRecord: RendererPropsRecord = { ...lowerPriorityRecord }

  for (const [type, props] of Object.entries(higherPriorityRecord)) {
    if (props === undefined) {
      continue
    }

    mergedRecord[type] = {
      ...mergedRecord[type],
      ...props,
    }
  }

  return mergedRecord as SchemxRendererPropsMap<TValues>
}
