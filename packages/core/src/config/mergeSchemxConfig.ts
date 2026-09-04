import { merge } from "es-toolkit"

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
 * 参数越靠前优先级越高：`configs[0]` 最高，后续参数依次降低；发生冲突时，
 * `schemaConfig` 和其他普通配置项取更靠前参数的值。`rendererProps` 按 Renderer
 * key 和 Props 属性浅合并，同名属性由更靠前参数覆盖；`validatorAdapters` 则按
 * 低优先级到高优先级排列，便于后续按 adapter 优先级解析。函数内部从最后一个
 * 参数开始向前应用配置，以实现上述优先级。
 * 函数不读取或修改全局配置，也不会修改输入对象或补齐任何默认值。
 *
 * @param configs - 按优先级从高到低传入的配置列表；第一个参数优先级最高。
 * @returns 保留未设置和显式 `undefined` 值的合并配置。
 *
 * @example
 * const config = mergeSchemxConfig(
 *   { schemaConfig: { readonly: true, labelWidth: "120px" } }, // 最高优先级
 *   { schemaConfig: { readonly: false, disabled: true, labelWidth: "80px" } },
 * )
 * // { schemaConfig: { readonly: true, disabled: true, labelWidth: "120px" } }
 *
 * @remarks
 * `undefined` 也是可被高优先级配置显式写入的值，可用于清除低优先级的字段默认值。
 * 如需补齐 Core 内置默认值，请使用 {@link resolveSchemxConfig}；如需一步完成，
 * 请使用 {@link mergeAndResolveSchemxConfig}。
 */
export function mergeSchemxConfig<TValues extends Values = Values>(
  ...configs: readonly SchemxConfig<TValues>[]
): SchemxConfig<TValues> {
  // 由低优先级到高优先级深度合并的对象型配置。
  const result: MutableSchemxConfig<TValues> = {}

  // 已按运行顺序累积的校验 adapter 列表。
  let validatorAdapters: readonly ValidationAdapterOption[] | undefined

  // 按 Renderer key 与 Props 属性浅合并的默认 Props。
  let rendererProps: SchemxRendererPropsMap<TValues> | undefined

  // 从最低优先级开始累积，使后续处理的高优先级配置可以覆盖已有值。
  for (let index = configs.length - 1; index >= 0; index -= 1) {
    // 当前正在合并的一层配置。
    const config = configs[index]

    // Adapter 使用追加语义，避免通用深合并按数组索引覆盖低优先级项。
    const {
      validatorAdapters: configValidatorAdapters,
      rendererProps: configRendererProps,
      ...objectConfig
    } = config

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

    if (configRendererProps !== undefined) {
      rendererProps = mergeRendererProps(rendererProps, configRendererProps)
    }
  }

  // Adapter 在对象合并后写入，确保不会被数组索引合并改变顺序。
  const mergedConfig: SchemxConfig<TValues> = {
    ...result,
    ...(validatorAdapters === undefined ? {} : { validatorAdapters }),
    ...(rendererProps === undefined ? {} : { rendererProps }),
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
export function resolveSchemxConfig<TValues extends Values = Values>(
  config: SchemxConfig<TValues> = {}
): MergedSchemxConfig<TValues> {
  // 尚未补齐默认值的 Schema 配置。
  const schemaConfig = config.schemaConfig

  // Runtime 消费的完整 Schema 配置。
  const resolvedSchemaConfig: SchemxSchemaConfig = { ...defaultSchemxConfig }

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
export function mergeAndResolveSchemxConfig<TValues extends Values = Values>(
  ...configs: readonly SchemxConfig<TValues>[]
): MergedSchemxConfig<TValues> {
  // 先保留所有层级的显式值，再在最后统一回退到内置默认值。
  const mergedConfig = mergeSchemxConfig(...configs)

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
