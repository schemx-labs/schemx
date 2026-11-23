/**
 * Field dependencies - 字段级动态呈现态派生。
 *
 * 根据 descriptor.dependencies 监听 triggerFields，并把解析结果写入
 * FieldModel snapshot signal。该模块不修改 descriptor/schema。
 *
 * @module core/field/dependencies
 */

import { createSignalEffect } from "../reactivity"

import { type FieldModel, updateFieldModel } from "./model"

import type { SchemxFormContext } from "../createForm"
import type { FieldDescriptor } from "../descriptor"
import type { Scope } from "../node"
import type {
  SchemxConditionFn,
  SchemxDependencies,
  SchemxFormApi,
  SchemxResolvedBaseField,
  Values,
} from "../types"

/**
 * 支持动态配置的字段呈现态键列表。
 */
export const FIELD_DEPENDENCIES_PROP_KEYS = [
  "componentProps",
  "placeholder",
  "required",
  "readonly",
  "disabled",
  "visible",
  "rules",
] as const

type DependenciesPropKey = (typeof FIELD_DEPENDENCIES_PROP_KEYS)[number]

export type DependenciesResolvedProps<TValues extends Values> = Partial<
  Pick<SchemxResolvedBaseField<TValues>, Exclude<DependenciesPropKey, "rules">> & {
    rules?: SchemxResolvedBaseField<TValues>["rules"]
  }
>

/**
 * 创建字段 dependencies effect 的运行时依赖。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateDependenciesEffectOptions<TValues extends Values = Values> {
  /**
   * 字段 descriptor，提供静态 schema、validation 和 dependencies 配置。
   */
  descriptor: Readonly<FieldDescriptor<TValues>>
  /**
   * 被 dependencies 动态写入的字段呈现态模型。
   */
  fieldModel: FieldModel<TValues>
  /**
   * form 内部运行时上下文。
   */
  context: SchemxFormContext<TValues>
  /**
   * 当前 effect 所属的资源作用域。
   */
  scope: Scope
}

/**
 * 创建字段级 dependencies effect。
 *
 * @param options - dependencies effect 所需的字段模型、descriptor 和运行时上下文。
 */
export function createDependenciesEffect<TValues extends Values = Values>(
  options: CreateDependenciesEffectOptions<TValues>
): void {
  const { descriptor, fieldModel, context, scope } = options
  const base = descriptor.schema
  const dependencies = descriptor.dependencies

  if (
    dependencies == null ||
    dependencies.triggerFields == null ||
    dependencies.triggerFields.length === 0
  ) {
    return
  }

  let version = 0

  const dispose = createSignalEffect(() => {
    const currentVersion = ++version

    // 读取 trigger 字段值以建立响应式依赖；字段值变化时 effect 会重新执行。
    void context.formApi.getValues(dependencies.triggerFields)

    void context.scheduler.track(
      resolveDependencies(dependencies, base, context.formApi).then((resolvedProps) => {
        if (scope.disposed || currentVersion !== version) {
          return
        }

        updateFieldModel(fieldModel, descriptor, resolvedProps)
      })
    )
  })

  scope.add(() => {
    version += 1
    dispose()
  })
}

/**
 * 解析单个字段的 dependencies 配置。
 */
async function resolveDependencies<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  base: Readonly<SchemxResolvedBaseField<TValues>>,
  formApi: SchemxFormApi<TValues>
): Promise<DependenciesResolvedProps<TValues>> {
  const values = formApi.getValues() as TValues

  const [resolvedProps] = await Promise.all([
    resolveDependenciesProps(dependencies, base, values, formApi),
    runDependenciesTrigger(dependencies, values, formApi),
  ])

  return resolvedProps
}

/**
 * 执行 dependencies.trigger 副作用。
 */
async function runDependenciesTrigger<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
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

/**
 * 解析 dependencies 中显式配置的动态属性。
 */
async function resolveDependenciesProps<TValues extends Values>(
  dependencies: SchemxDependencies<TValues>,
  base: Readonly<SchemxResolvedBaseField<TValues>>,
  values: TValues,
  formApi: SchemxFormApi<TValues>
): Promise<DependenciesResolvedProps<TValues>> {
  const [componentProps, placeholder, required, readonly, disabled, visible, rules] =
    await Promise.all([
      resolveDependenciesProp({
        condition: dependencies.componentProps,
        values,
        formApi,
        defaultValue: base.componentProps,
      }),
      resolveDependenciesProp({
        condition: dependencies.placeholder,
        values,
        formApi,
        defaultValue: base.placeholder,
      }),
      resolveDependenciesProp({
        condition: dependencies.required,
        values,
        formApi,
        defaultValue: base.required,
      }),

      resolveDependenciesProp({
        condition: dependencies.readonly,
        values,
        formApi,
        defaultValue: base.readonly,
      }),
      resolveDependenciesProp({
        condition: dependencies.disabled,
        values,
        formApi,
        defaultValue: base.disabled,
      }),
      resolveDependenciesProp({
        condition: dependencies.visible,
        values,
        formApi,
        defaultValue: base.visible,
      }),
      resolveDependenciesProp({
        condition: dependencies.rules,
        values,
        formApi,
        defaultValue: base.rules,
      }),
    ])

  return {
    componentProps,
    placeholder,
    required,
    readonly,
    disabled,
    visible,
    rules,
  }
}

/**
 * 解析单个动态属性；未配置时返回静态默认值。
 */
async function resolveDependenciesProp<TValues extends Values, TValue>(options: {
  condition?: SchemxConditionFn<TValues, TValue>
  values: TValues
  formApi: SchemxFormApi<TValues>
  defaultValue: TValue | undefined
}): Promise<TValue | undefined> {
  const { condition, values, formApi, defaultValue } = options

  if (condition == null) {
    return defaultValue
  }

  return resolveCondition(formApi, condition, values, defaultValue)
}

/**
 * 执行单个动态属性条件函数。
 */
async function resolveCondition<TValues extends Values, TValue>(
  formApi: SchemxFormApi<TValues>,
  condition: SchemxConditionFn<TValues, TValue>,
  formValues: TValues,
  defaultValue: TValue | undefined
): Promise<TValue | undefined> {
  try {
    const result = await condition(formValues, formApi)

    return result ?? defaultValue
  } catch (error) {
    console.error("[schemx] 解析动态属性时发生错误:", error)

    return defaultValue
  }
}
