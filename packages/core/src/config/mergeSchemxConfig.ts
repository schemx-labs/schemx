import { merge } from "es-toolkit"

import { defaultSchemxConfig, defaultSchemxConfigKeys } from "./defaultSchemxConfig"

import type { SchemxConfig } from "./schemxConfig"
import type { ResolvedSchemxSchemaConfig, SchemxSchemaConfig } from "../types"
import type { ValidationAdapterOption } from "../validator/types"

/**
 * 合并过程使用的可写配置视图。
 *
 * 函数返回前会再次收敛为只读的 {@link SchemxConfig} 公共契约。
 */
type MutableSchemxConfig = {
  -readonly [TKey in keyof SchemxConfig]: SchemxConfig[TKey]
}

/**
 * 补齐默认值后可直接交给 Form Runtime 的 Schemx 配置。
 */
export interface MergedSchemxConfig extends Omit<SchemxConfig, "schemaConfig"> {
  /**
   * 已合并并补齐全部内置默认值的 Schema 配置。
   */
  readonly schemaConfig: ResolvedSchemxSchemaConfig
}

/**
 * 按从后到前的优先级合并多个 Schemx 配置。
 *
 * 参数越靠前优先级越高。对象字段由 `es-toolkit` 的 `merge` 深度合并；
 * `validatorAdapters` 按低优先级到高优先级排列，其他配置项取最高优先级值。
 * 函数不读取或修改全局配置，也不会修改输入对象或补齐任何默认值。
 *
 * @param configs - 按高到低优先级传入的配置列表。
 * @returns 保留未设置和显式 `undefined` 值的合并配置。
 *
 * @example
 * const config = mergeSchemxConfig(
 *   { schemaConfig: { readonly: true } },
 *   { schemaConfig: { disabled: true } }
 * )
 * // { schemaConfig: { disabled: true, readonly: true } }
 *
 * @remarks
 * `undefined` 也是可被高优先级配置显式写入的值，可用于清除低优先级的字段默认值。
 * 如需补齐 Core 内置默认值，请使用 {@link resolveSchemxConfig}；如需一步完成，
 * 请使用 {@link mergeAndResolveSchemxConfig}。
 */
export function mergeSchemxConfig(...configs: readonly SchemxConfig[]): SchemxConfig {
  // 由低优先级到高优先级深度合并的对象型配置。
  const result: MutableSchemxConfig = {}

  // 已按运行顺序累积的校验 adapter 列表。
  let validatorAdapters: readonly ValidationAdapterOption[] | undefined

  // 从最低优先级开始累积，使后续处理的高优先级配置可以覆盖已有值。
  for (let index = configs.length - 1; index >= 0; index -= 1) {
    // 当前正在合并的一层配置。
    const config = configs[index]

    // Adapter 使用追加语义，避免通用深合并按数组索引覆盖低优先级项。
    const { validatorAdapters: configValidatorAdapters, ...objectConfig } = config

    // 使用库的深合并能力处理对象配置和未来新增的嵌套配置项。
    merge(result, objectConfig)

    // `merge` 会忽略 undefined；这里保留 Schema 配置用 undefined 清除继承值的语义。
    if (config.schemaConfig !== undefined) {
      // 当前层显式清除的 Schema 配置键。
      const undefinedSchemaConfig = Object.fromEntries(
        Object.entries(config.schemaConfig).filter(([, value]) => value === undefined)
      ) as Partial<SchemxSchemaConfig>

      result.schemaConfig = {
        ...result.schemaConfig,
        ...undefinedSchemaConfig,
      }
    }

    if (configValidatorAdapters !== undefined) {
      validatorAdapters = [...(validatorAdapters ?? []), ...configValidatorAdapters]
    }
  }

  // Adapter 在对象合并后写入，确保不会被数组索引合并改变顺序。
  const mergedConfig: SchemxConfig = {
    ...result,
    ...(validatorAdapters === undefined ? {} : { validatorAdapters }),
  }

  return mergedConfig
}

/**
 * 为单个已合并 Schemx 配置补齐 Schema 内置默认值。
 *
 * 除 `schemaConfig` 外的配置项保持原值；输入对象及其嵌套配置不会被修改。
 * `schemaConfig` 中缺失或显式为 `undefined` 的字段均回退到 Core 内置默认值。
 *
 * @param config - 已合并或待解析的 Schemx 配置。
 * @returns 可直接供 Runtime 消费的完整配置。
 */
export function resolveSchemxConfig(config: SchemxConfig = {}): MergedSchemxConfig {
  // 尚未补齐默认值的 Schema 配置。
  const schemaConfig = config.schemaConfig

  // Runtime 消费的完整 Schema 配置。
  const resolvedSchemaConfig: ResolvedSchemxSchemaConfig = { ...defaultSchemxConfig }

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
 * 这是 {@link mergeSchemxConfig} 与 {@link resolveSchemxConfig} 的便捷组合，
 * 适用于需要立即交给 Form Runtime 消费的场景。
 *
 * @param configs - 按高到低优先级传入的配置列表。
 * @returns 合并且补齐默认值后的完整配置。
 */
export function mergeAndResolveSchemxConfig(
  ...configs: readonly SchemxConfig[]
): MergedSchemxConfig {
  // 先保留所有层级的显式值，再在最后统一回退到内置默认值。
  const mergedConfig = mergeSchemxConfig(...configs)

  return resolveSchemxConfig(mergedConfig)
}
