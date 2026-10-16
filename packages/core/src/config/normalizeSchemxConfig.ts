import type { SchemxRendererPropsMap, Values } from "../types"
import type { SchemxConfig } from "./types"

/**
 * 将 Schemx 配置复制为可复用的快照。
 *
 * 该 helper 保留配置声明合并产生的扩展字段；Core 只对自身拥有的嵌套字段做边界复制。
 * Registry 实例保持其可变语义，不会被深度冻结。
 *
 * @param source - 待标准化的 Schemx 配置。
 * @returns 与输入隔离一层的只读配置快照。
 *
 * @example
 * ```ts
 * const snapshot = normalizeSchemxConfig({
 *   schemaConfig: { readonly: true },
 * })
 * ```
 */
export function normalizeSchemxConfig<TValues extends Values = Values>(
  source: SchemxConfig<TValues>
): SchemxConfig<TValues> {
  return Object.freeze({
    ...source,
    schemaConfig: Object.freeze({ ...source.schemaConfig }),
    rendererProps: normalizeRendererProps(source.rendererProps),
    validatorAdapters: Object.freeze([...(source.validatorAdapters ?? [])]),
    defaultRendererType: source.defaultRendererType,
    rendererRegistry: source.rendererRegistry,
    presetRuleRegistry: source.presetRuleRegistry,
  })
}

/**
 * 复制 Renderer Props Map 外层及每个 Renderer 的 Props 对象。
 *
 * @param source - 待标准化的 Renderer Props Map。
 * @returns 与输入隔离一层的只读配置。
 */
function normalizeRendererProps<TValues extends Values>(
  source: SchemxRendererPropsMap<TValues> | undefined
): SchemxRendererPropsMap<TValues> | undefined {
  if (source === undefined) {
    return undefined
  }

  const entries = Object.entries(source).map(([type, props]) => {
    return [type, props === undefined ? undefined : Object.freeze({ ...props })]
  })

  return Object.freeze(Object.fromEntries(entries)) as SchemxRendererPropsMap<TValues>
}
