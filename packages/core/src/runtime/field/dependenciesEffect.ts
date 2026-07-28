/**
 * Field dependencies - 字段级动态呈现态派生。
 *
 * 根据 descriptor.dynamicProps 监听 triggerFields，并把解析结果写入
 * FieldRuntimeState.dynamicOverrides。
 * 该模块不修改 descriptor/schema。
 *
 * @module core/runtime/field/dependencies
 */

import {
  createDepSchedulerEffect,
  resolveDependencyProps,
} from "../dependencySchedulerEffect"

import { type FieldRuntimeState, setFieldDynamicOverrides } from "./runtimeState"

import type { SchemxResolvedBaseField, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { FieldDescriptor } from "../descriptor"
import type { Scope } from "../node"

/**
 * 可通过 dependencies 动态配置的字段属性 key 列表。
 *
 * 这些属性可以在运行时根据 trigger 字段值动态计算，
 * 覆盖静态 schema 中对应的值。
 */
export const FIELD_DEPENDENCIES_PROP_KEYS = [
  "componentProps",
  "placeholder",
  "required",
  "showRequiredMark",
  "readonly",
  "readonlyPlaceholder",
  "disabled",
  "visible",
  "rules",
] as const

type DependenciesPropKey = (typeof FIELD_DEPENDENCIES_PROP_KEYS)[number]

/**
 * dependencies 动态属性解析结果类型。
 *
 * 从 FIELD_DEPENDENCIES_PROP_KEYS 中选取非空值 key，
 * 其中 rules 单独处理（不与其它 key 共用类型约束）。
 *
 * @typeParam TValues - 表单值类型
 */
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
   * 当前 form 实例运行时上下文。
   */
  context: SchemaRuntimeContext<TValues>

  /**
   * Scheduler 队列中标识当前字段动态属性任务的唯一 ID。
   */
  taskId: string

  /**
   * 字段 descriptor，提供静态 schema、validation 和 dependencies 配置。
   */
  descriptor: Readonly<FieldDescriptor<TValues>>
  /**
   * 字段运行态（Signal Graph 阶段），dependencies 结果会写入 dynamicOverrides。
   */
  runtimeState: FieldRuntimeState<TValues>
  /**
   * 当前 effect 所属的资源作用域。
   */
  scope: Scope
}

/**
 * 创建字段级 dependencies effect。
 *
 * @param options - dependencies effect 所需的 descriptor、runtimeState 和运行时上下文。
 */
export function createDependenciesEffect<TValues extends Values = Values>(
  options: CreateDependenciesEffectOptions<TValues>
): void {
  // 字段 dependencies effect 使用的运行时资源。
  const { context, taskId, descriptor, runtimeState, scope } = options

  // 字段 descriptor 中编译后的动态属性描述。
  const dynamicProps = descriptor.dynamicProps

  // 原始字段 dependencies 配置。
  const dependencies = dynamicProps?.dependencies

  // 当前动态属性 effect 明确订阅的字段列表。
  const triggerFields = dynamicProps?.triggerFields

  if (dependencies == null || triggerFields == null || triggerFields.length === 0) {
    return
  }

  createDepSchedulerEffect<TValues, DependenciesResolvedProps<TValues>>({
    context,
    triggerFields,
    taskId,
    scope,
    run: () =>
      resolveDependencyProps<TValues, DependenciesResolvedProps<TValues>>(
        dependencies,
        FIELD_DEPENDENCIES_PROP_KEYS,
        context.formApi
      ),
    onSuccess: (resolvedProps) => {
      setFieldDynamicOverrides(runtimeState, resolvedProps, {
        source: "dependencies",
        triggerFields,
      })
    },
    onError: (error) => {
      console.error("[schemx] 字段 dependencies 执行错误:", error)
    },
  })
}
