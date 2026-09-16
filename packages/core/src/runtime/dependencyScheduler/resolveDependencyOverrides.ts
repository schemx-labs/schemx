/**
 * dependencies 动态属性解析器。
 *
 * @module core/runtime/dependencyScheduler/resolveDependencyOverrides
 */

import type { NamePath, SchemxConditionFn, SchemxFormApi, Values } from "../../types"

/**
 * 动态属性解析所需的 dependencies 公共结构。
 *
 * @typeParam TValues - 当前表单值类型。
 */
export interface DependencyResolverConfig<TValues extends Values = Values> {
  /**
   * 重新计算动态属性与执行副作用时监听的字段路径。
   */
  readonly triggerFields: readonly NamePath<TValues>[]

  /**
   * 与动态属性解析并行执行的可选副作用。
   *
   * 副作用异常会被独立捕获，不会阻断其他动态属性的解析结果。
   */
  readonly trigger?: SchemxConditionFn<TValues, void>
}

/**
 * @deprecated 请改用 {@link DependencyResolverConfig}。
 */
export type DependencyEffectDependencies<TValues extends Values = Values> =
  DependencyResolverConfig<TValues>

/**
 * 解析当前表单快照中所有已配置的动态属性。
 *
 * 每个属性条件函数都会独立处理异常：失败的属性不会出现在返回覆盖中，
 * 其他属性和 `trigger` 仍可正常完成。
 *
 * @typeParam TValues - 当前表单值类型。
 * @typeParam TProps - 可解析的动态属性集合。
 * @param dependencies - 保存条件函数和副作用的依赖配置。
 * @param propKeys - 要解析的动态属性键。
 * @param formApi - 用于读取全量快照和传入用户回调的表单 API。
 * @param schemaLabel - 当前 dependencies 所属 schema 的展示标识。
 * @returns 仅包含成功且非空结果的动态属性覆盖。
 */
export async function resolveDependencyOverrides<
  TValues extends Values,
  TProps extends object,
>(
  dependencies: DependencyResolverConfig<TValues>,
  propKeys: readonly string[],
  formApi: SchemxFormApi<TValues>,
  schemaLabel: string
): Promise<TProps> {
  // 当前解析批次使用的完整表单值快照。
  const values = formApi.getFieldsValue() as TValues

  // 将可扩展的依赖对象转换为按属性键读取的记录。
  const dependencyRecord = dependencies as DependencyResolverConfig<TValues> &
    Record<string, unknown>

  // 并行解析各动态属性，并同步启动可选副作用。
  const [entries] = await Promise.all([
    Promise.all(
      propKeys
        .filter((key) => dependencyRecord[key] != null)
        .map(async (key) => {
          // 当前动态属性对应的条件函数。
          const condition = dependencyRecord[key] as SchemxConditionFn<TValues, unknown>

          try {
            // 当前属性在本次快照下的解析结果。
            const value = await condition(values, formApi)

            return [key, value] as const
          } catch (error) {
            // 单个属性失败时保留其他属性的成功结果。
            console.error(`[schemx] ${schemaLabel} 动态属性 "${key}" 解析错误`, error)

            return [key, undefined] as const
          }
        })
    ),
    runTrigger(dependencies, values, formApi, schemaLabel),
  ])

  return Object.fromEntries(entries.filter(([, value]) => value != null)) as TProps
}

/**
 * @deprecated 请改用 {@link resolveDependencyOverrides}。
 */
export const resolveDependencyProps: typeof resolveDependencyOverrides =
  resolveDependencyOverrides

/**
 * 执行 dependencies 配置中的可选副作用。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param dependencies - 可能包含副作用函数的 dependencies 配置。
 * @param values - 当前解析批次的完整表单值快照。
 * @param formApi - 传入副作用函数的表单 API。
 * @param schemaLabel - 当前 dependencies 所属 schema 的展示标识。
 * @returns 副作用结束后完成的 Promise。
 */
async function runTrigger<TValues extends Values>(
  dependencies: DependencyResolverConfig<TValues>,
  values: TValues,
  formApi: SchemxFormApi<TValues>,
  schemaLabel: string
): Promise<void> {
  if (!dependencies.trigger) {
    return
  }

  try {
    await dependencies.trigger(values, formApi)
  } catch (error) {
    // 副作用失败不应阻断动态属性的并行解析。
    console.error(`[schemx] ${schemaLabel} trigger 执行错误`, error)
  }
}
