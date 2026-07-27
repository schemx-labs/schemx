/**
 * 通用动态属性 effect。
 *
 * 负责监听 triggerFields、解析同步或异步条件函数、执行 trigger 副作用，
 * 并通过可取消任务保证旧结果不会覆盖最新状态。
 *
 * @module core/runtime/dynamicProps/effect
 */

import { createSignalEffect, runUntracked } from "../../reactivity"
import { createAbortableTaskRunner } from "../scheduler/abortableTaskRunner"

import type { NamePath, SchemxConditionFn, SchemxFormApi, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { Scope } from "../node"

/**
 * 动态属性配置需要具备的公共结构。
 */
export interface DynamicPropsDependencies<TValues extends Values = Values> {
  readonly triggerFields: readonly NamePath<TValues>[]
  readonly trigger?: SchemxConditionFn<TValues, void>
}

/**
 * 创建通用动态属性 effect 的配置。
 */
export interface CreateDynamicPropsEffectOptions<
  TValues extends Values,
  TResolved extends object,
> {
  readonly context: SchemaRuntimeContext<TValues>
  readonly dependencies: DynamicPropsDependencies<TValues>
  readonly triggerFields: readonly NamePath<TValues>[]
  readonly propKeys: readonly Extract<keyof TResolved, string>[]
  readonly scope: Scope
  readonly onSuccess: (resolved: TResolved) => void
}

/**
 * 创建并挂载动态属性 effect。
 *
 * @param options - 动态属性、触发字段、结果回调和生命周期作用域。
 */
export function createDynamicPropsEffect<
  TValues extends Values,
  TResolved extends object,
>(options: CreateDynamicPropsEffectOptions<TValues, TResolved>): void {
  const { context, dependencies, triggerFields, propKeys, scope, onSuccess } = options

  if (triggerFields.length === 0) {
    return
  }

  const { formApi, scheduler } = context

  const taskRunner = createAbortableTaskRunner<TResolved>({
    scope,
    scheduler,
    run: () => resolveDynamicProps(dependencies, propKeys, formApi),
    onSuccess,
    onError: (error) => {
      console.error("[schemx] dependencies 执行错误:", error)
    },
  })

  const dispose = createSignalEffect(() => {
    void formApi.getValues([...triggerFields])

    // 解析全量快照及执行用户回调不应扩大 triggerFields 的订阅范围。
    runUntracked(() => {
      void taskRunner.run()
    })
  })

  scope.add(dispose)
}

async function resolveDynamicProps<TValues extends Values, TResolved extends object>(
  dependencies: DynamicPropsDependencies<TValues>,
  propKeys: readonly Extract<keyof TResolved, string>[],
  formApi: SchemxFormApi<TValues>
): Promise<TResolved> {
  const values = formApi.getValues() as TValues

  const dependencyRecord = dependencies as DynamicPropsDependencies<TValues> &
    Record<string, unknown>

  const [entries] = await Promise.all([
    Promise.all(
      propKeys
        .filter((key) => dependencyRecord[key] != null)
        .map(async (key) => {
          const condition = dependencyRecord[key] as SchemxConditionFn<TValues, unknown>

          try {
            const value = await condition(values, formApi)

            return [key, value] as const
          } catch (error) {
            console.error("[schemx] 解析动态属性时发生错误:", error)

            return [key, undefined] as const
          }
        })
    ),
    runTrigger(dependencies, values, formApi),
  ])

  return Object.fromEntries(entries.filter(([, value]) => value != null)) as TResolved
}

async function runTrigger<TValues extends Values>(
  dependencies: DynamicPropsDependencies<TValues>,
  values: TValues,
  formApi: SchemxFormApi<TValues>
): Promise<void> {
  if (!dependencies.trigger) {
    return
  }

  try {
    await dependencies.trigger(values, formApi)
  } catch (error) {
    console.error("[schemx] trigger 执行错误:", error)
  }
}
