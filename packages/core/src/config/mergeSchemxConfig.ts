import { mergeValidatorAdapters } from "../validator/adapters"

import { defaultSchemxConfig, defaultSchemxConfigKeys } from "./defaultSchemxConfig"

import type { SchemxConfig } from "./schemxConfig"
import type { SchemxRendererPropsMap, SchemxSchemaConfig, Values } from "../types"
import type { ValidationAdapterOption } from "../validator/types"

/**
 * 合并过程使用的可写配置视图。
 *
 * 函数返回前会再次收敛为只读的 {@link SchemxConfig} 公共契约。
 */
type MutableSchemxConfig<TValues extends Values> = {
  -readonly [TKey in keyof SchemxConfig<TValues>]: SchemxConfig<TValues>[TKey]
}

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
   * 已合并并补齐全部内置默认值的 Schema 配置。
   */
  readonly schemaConfig: SchemxSchemaConfig
}

/**
 * 按参数顺序从高到低合并多个 Schemx 配置。
 *
 * `schemaConfig` 按属性浅合并，属性值中的数组、对象和函数均由高优先级配置整体
 * 替换并保留原引用。`rendererProps` 按 Renderer key 和 Props 属性浅合并。
 * `validatorAdapters` 在不同配置层之间按 ID 合并，高优先级 adapter 覆盖低优先级
 * 同 ID adapter，并按高到低优先级排列；同一配置层内的重复 ID 仍交由 Validator
 * 按 `override` 规则校验。其他配置项取最高优先级的非 `undefined` 值。
 * 函数不读取或修改全局配置，也不会修改输入对象或补齐任何默认值。
 *
 * @typeParam TValues - 用于关联 Renderer 类型与默认 Props 的表单值类型。
 * @param configs - 按优先级从高到低传入的配置列表；第一个参数优先级最高。
 * @returns 按各配置项语义合并后的新配置。
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
  ...configs: readonly SchemxConfig<TValues>[]
): SchemxConfig<TValues> {
  // 逐项应用配置语义，避免通用深合并改变数组或扩展对象的含义。
  const result: MutableSchemxConfig<TValues> = {}

  // 从最低优先级（从后往前）开始累积，使后续处理的高优先级配置可以覆盖已有值。
  for (let index = configs.length - 1; index >= 0; index -= 1) {
    // 当前正在合并的一层配置。
    const config = configs[index]

    if (config.schemaConfig !== undefined) {
      result.schemaConfig = {
        ...result.schemaConfig,
        ...config.schemaConfig,
      }
    }

    if (config.rendererProps !== undefined) {
      result.rendererProps = mergeRendererProps(
        result.rendererProps,
        config.rendererProps
      )
    }

    if (config.defaultRendererType !== undefined) {
      result.defaultRendererType = config.defaultRendererType
    }

    if (config.rendererRegistry !== undefined) {
      result.rendererRegistry = config.rendererRegistry
    }

    if (config.presetRuleRegistry !== undefined) {
      result.presetRuleRegistry = config.presetRuleRegistry
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
    result.validatorAdapters = validatorAdapters
  }

  return result
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
 * 除 `schemaConfig` 外的配置项保持原值；输入对象及其嵌套配置不会被修改。
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
  const schemaConfig = config.schemaConfig

  // Runtime 消费的完整 Schema 配置。
  const resolvedSchemaConfig: SchemxSchemaConfig = {
    ...defaultSchemxConfig,
    ...(schemaConfig ?? {}),
  }

  // 将缺失或显式 undefined 的字段归一化为内置默认值。
  for (const key of defaultSchemxConfigKeys) {
    Object.assign(resolvedSchemaConfig, {
      [key]: schemaConfig?.[key] ?? defaultSchemxConfig[key],
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
  ...configs: readonly SchemxConfig<TValues>[]
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
