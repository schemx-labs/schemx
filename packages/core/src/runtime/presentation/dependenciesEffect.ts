/**
 * 呈现状态依赖 effect。
 *
 * @module core/runtime/presentation/dependenciesEffect
 */

import {
  createDependencySchedulerEffect,
  resolveDependencyOverrides,
} from "../dependencyScheduler"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type {
  DependencyNode,
  DynamicNode,
  GroupNode,
  PresentationDependencyOverrides,
  Scope,
} from "../node"

type StatefulPresentationNode<TValues extends Values> =
  GroupNode<TValues> | DependencyNode<TValues> | DynamicNode<TValues>

/**
 * 容器依赖配置支持的动态属性键。
 *
 * 容器只覆盖呈现状态，不解析字段专属的 `componentProps`、`rules` 等属性。
 */
export const PRESENTATION_DEPENDENCY_OVERRIDE_KEYS = [
  "visible",
  "readonly",
  "disabled",
] as const

/**
 * @deprecated 请改用 {@link PRESENTATION_DEPENDENCY_OVERRIDE_KEYS}。
 */
export const PRESENTATION_DYNAMIC_OVERRIDE_KEYS = PRESENTATION_DEPENDENCY_OVERRIDE_KEYS

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
   * 接收动态覆盖的 Group、Dependency 或 Dynamic 节点。
   */
  readonly node: StatefulPresentationNode<TValues>

  /**
   * 控制 effect 与异步任务生命周期的作用域。
   */
  readonly scope: Scope
}

/**
 * 创建容器级 dependencies effect。
 *
 * 该 effect 统一处理 Group、Dependency 和 Dynamic 的 `visible`、`readonly`、`disabled`
 * 动态覆盖，并将解析结果写入容器 Node 的 Signal。
 *
 * @typeParam TValues - 当前表单值类型。
 * @param options - 容器 Node 和资源作用域。
 *
 * @remarks
 * 具体的字段订阅、异步竞态和 `trigger` 执行由通用依赖 effect 负责。
 */
export function createPresentationDependenciesEffect<TValues extends Values>(
  options: CreatePresentationDependenciesEffectOptions<TValues>
): void {
  const { context, taskId, node, schemaLabel, scope } = options

  const dependencies = node.compiledSchema.value.dependencies

  if (!dependencies) {
    return
  }

  createDependencySchedulerEffect<TValues, PresentationDependencyOverrides>({
    context,
    triggerFields: dependencies.triggerFields,
    taskId,
    scope,
    run: () =>
      resolveDependencyOverrides<TValues, PresentationDependencyOverrides>(
        dependencies,
        PRESENTATION_DEPENDENCY_OVERRIDE_KEYS,
        context.formApi,
        schemaLabel
      ),
    onSuccess: (dependencyOverrides) => {
      // 使用最新 dependencies 解析结果替换容器动态覆盖。
      node.dependencyOverrides.value = dependencyOverrides
    },
    onError: (error) => {
      console.error(`[schemx] ${schemaLabel} dependencies 执行错误`, error)
    },
  })
}
