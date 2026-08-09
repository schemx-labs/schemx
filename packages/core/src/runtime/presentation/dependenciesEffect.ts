/**
 * 呈现状态依赖 effect。
 *
 * @module core/runtime/presentation/dependenciesEffect
 */

import {
  createDepSchedulerEffect,
  resolveDependencyProps,
} from "../dependencySchedulerEffect"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { PresentationDynamicProps, Scope } from "../node"
import type { PresentationDynamicOverrides, PresentationRuntimeState } from "./state"

/**
 * 容器依赖配置支持的动态属性键。
 *
 * 容器只覆盖呈现状态，不解析字段专属的 `componentProps`、`rules` 等属性。
 */
export const PRESENTATION_DEPENDENCIES_PROP_KEYS = [
  "visible",
  "readonly",
  "disabled",
] as const

/**
 * 创建容器 dependencies effect 的配置。
 */
export interface CreatePresentationDependenciesEffectOptions<
  TValues extends Values = Values,
> {
  /**
   * 提供表单值读取和任务调度能力的运行时上下文。
   */
  readonly context: SchemaRuntimeContext<TValues>

  /**
   * Scheduler 队列中标识当前容器动态属性任务的唯一 ID。
   */
  readonly taskId: string

  /**
   * 当前容器 schema 的稳定标识，用于输出可定位的错误日志。
   */
  readonly schemaLabel: string

  /**
   * 容器依赖描述，包含触发字段与动态条件函数。
   */
  readonly dynamicProps: PresentationDynamicProps<TValues>

  /**
   * 接收动态容器状态覆盖的运行时状态。
   */
  readonly runtimeState: PresentationRuntimeState

  /**
   * 控制 effect 与异步任务生命周期的作用域。
   */
  readonly scope: Scope
}

/**
 * 创建容器级 dependencies effect。
 *
 * 该 effect 统一处理 Group 和 Dependency 的 `visible`、`readonly`、`disabled`
 * 动态覆盖，并将解析结果写入容器运行时状态。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param options - 动态属性描述、运行时状态和资源作用域。
 *
 * @remarks
 * 具体的字段订阅、异步竞态和 `trigger` 执行由通用依赖 effect 负责。
 */
export function createPresentationDependenciesEffect<TValues extends Values>(
  options: CreatePresentationDependenciesEffectOptions<TValues>
): void {
  // 解构容器依赖 effect 所需的运行时资源。
  const { context, taskId, dynamicProps, runtimeState, schemaLabel, scope } = options

  createDepSchedulerEffect<TValues, PresentationDynamicOverrides>({
    context,
    triggerFields: dynamicProps.triggerFields,
    taskId,
    scope,
    run: () =>
      resolveDependencyProps<TValues, PresentationDynamicOverrides>(
        dynamicProps.dependencies,
        PRESENTATION_DEPENDENCIES_PROP_KEYS,
        context.formApi,
        schemaLabel
      ),
    onSuccess: (overrides) => {
      // 使用最新 dependencies 解析结果替换容器动态覆盖。
      runtimeState.dynamicOverrides.value = overrides
    },
    onError: (error) => {
      console.error(`[schemx] ${schemaLabel} dependencies 执行错误`, error)
    },
  })
}
