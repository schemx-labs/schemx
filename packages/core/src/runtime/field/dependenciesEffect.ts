/**
 * Field dependencies - 字段级动态呈现态派生。
 *
 * 根据 compiledSchema 中的依赖配置监听 triggerFields，并把解析结果写入
 * FieldNode.dependencyOverrides。
 * 该模块不修改 descriptor/schema。
 *
 * @module core/runtime/field/dependenciesEffect
 */

import {
  createDependencySchedulerEffect,
  resolveDependencyOverrides,
} from "../dependencyScheduler"
import { updateFieldDiagnostics } from "../node/helper"

import type { Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type {
  FieldDependencyOverrideKey,
  FieldDependencyOverrides,
  FieldNode,
  Scope,
} from "../node"

/**
 * 可通过 dependencies 动态配置的字段属性 key 列表。
 *
 * 这些属性可以在运行时根据 trigger 字段值动态计算，
 * 覆盖静态 schema 中对应的值。
 */
export const FIELD_DEPENDENCY_OVERRIDE_KEYS = [
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

/**
 * @deprecated 请改用 {@link FIELD_DEPENDENCY_OVERRIDE_KEYS}。
 */
export const FIELD_DYNAMIC_OVERRIDE_KEYS = FIELD_DEPENDENCY_OVERRIDE_KEYS

/**
 * 获取当前 dependencies 中需要解析的属性键。
 *
 * Core 内置属性保留固定类型；由适配层通过 Definition 声明合并增加的动态属性
 * 通过运行时键自动纳入解析，不需要 Core 认识具体字段名。
 */
function getFieldDependencyOverrideKeys(dependencies: object): readonly string[] {
  const keys = new Set<string>(FIELD_DEPENDENCY_OVERRIDE_KEYS)

  for (const key of Object.keys(dependencies)) {
    if (key !== "triggerFields" && key !== "trigger") {
      keys.add(key)
    }
  }

  return [...keys]
}

/**
 * 创建字段 dependencies effect 的运行时依赖。
 *
 * @typeParam TValues - 表单值类型。
 */
export interface CreateFieldDependenciesEffectOptions<TValues extends Values = Values> {
  /**
   * 当前 form 实例运行时上下文。
   */
  context: SchemaRuntimeContext<TValues>

  /**
   * Scheduler 队列中标识当前字段动态属性任务的唯一 ID。
   */
  taskId: string

  /**
   * 字段 Node，提供静态 schema 和动态覆盖 Signal。
   */
  node: FieldNode<TValues>
  /**
   * 当前 effect 所属的资源作用域。
   */
  scope: Scope
}

/**
 * 创建字段级 dependencies effect。
 *
 * @param options - dependencies effect 所需的 Node 和运行时上下文。
 *
 * @example
 * ```ts
 * createFieldDependenciesEffect({ context, taskId, node, scope })
 * ```
 */
export function createFieldDependenciesEffect<TValues extends Values = Values>(
  options: CreateFieldDependenciesEffectOptions<TValues>
): void {
  // 字段 dependencies effect 使用的运行时资源。
  const { context, taskId, node, scope } = options

  // 字段 dependencies 配置。
  const dependencies = node.compiledSchema.value.dependencies

  // 当前动态属性 effect 明确订阅的字段列表。
  const triggerFields = dependencies?.triggerFields

  if (dependencies == null || triggerFields == null || triggerFields.length === 0) {
    return
  }

  createDependencySchedulerEffect<
    TValues,
    FieldDependencyOverrides<TValues> & Record<string, unknown>
  >({
    context,
    triggerFields,
    taskId,
    scope,
    run: () =>
      resolveDependencyOverrides<TValues, FieldDependencyOverrides<TValues>>(
        dependencies,
        getFieldDependencyOverrideKeys(dependencies),
        context.formApi,
        `字段 "${String(node.name.value)}"`
      ),
    onSuccess: (dependencyOverrides) => {
      node.dependencyOverrides.value = dependencyOverrides
      updateFieldDiagnostics(node, {
        lastUpdatedBy: "dependencies",
        triggerFields,
        overriddenKeys: Object.keys(dependencyOverrides) as FieldDependencyOverrideKey[],
        error: null,
      })
    },
    onError: (error) => {
      console.error(
        `[schemx] 字段 "${String(node.name.value)}" dependencies 执行错误`,
        error
      )
    },
  })
}
