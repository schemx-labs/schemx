/**
 * DependencyEffect - dependency renderer 执行态容器。
 *
 * Effect state 只记录异步执行状态。renderer 返回的结构由 reconciler 写入
 * DependencyRuntimeNode.childNodes。
 *
 * @module core/runtime/field/dependencyEffect
 */

import { createSignal } from "../../reactivity"
import { createDepSchedulerEffect } from "../dependencySchedulerEffect"
import { type DependencyDescriptor, isDependencyDescriptor } from "../descriptor"

import type { Signal } from "../../reactivity"
import type { SchemxField, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyRuntimeNode, RuntimeDispose } from "../node"

/**
 * 检查 DependencyRuntimeNode 是否有 DependencyEffectState。
 *
 * @param node - dependency runtime 节点。
 * @returns 已挂载 effect state 时返回 true。
 */
export function hasDependencyEffect(node: DependencyRuntimeNode): boolean {
  return getDependencyEffect(node) != null
}

/**
 * 从 DependencyRuntimeNode 获取 DependencyEffectState。
 *
 * @param node - dependency runtime 节点。
 * @returns 当前 effect state；尚未挂载时返回 undefined。
 */
export function getDependencyEffect(
  node: DependencyRuntimeNode
): DependencyEffectState | undefined {
  return node.effectState ?? undefined
}

/**
 * Dependency renderer 的执行状态与控制句柄。
 */
export interface DependencyEffectState {
  /**
   * renderer 是否正在执行。
   */
  readonly loading: Signal<boolean>

  /**
   * 最新一次 renderer 执行错误。
   */
  readonly error: Signal<Error | null>

  /**
   * renderer 启动或 effect 释放时递增的版本号。
   */
  readonly version: Signal<number>

  /**
   * 当前 renderer 任务使用的 AbortController。
   */
  readonly abortController: Signal<AbortController | null>

  /**
   * 执行 dependency renderer。
   *
   * @returns renderer 执行完成后 resolve 的 Promise。
   */
  run(): Promise<void>

  /**
   * 释放当前 dependency effect 持有的异步资源。
   */
  dispose(): void
}

/**
 * 创建 DependencyEffect 的配置选项。
 *
 * @typeParam TValues - 表单值类型
 */
export interface CreateDependencyEffectOptions<TValues extends Values = Values> {
  /**
   * 当前 form 实例运行时上下文。
   */
  context: SchemaRuntimeContext<TValues>

  /**
   * dependency runtime 节点。
   */
  node: DependencyRuntimeNode<TValues>

  /**
   * dependency descriptor，提供静态 trigger、renderer 配置。
   */
  descriptor: DependencyDescriptor<TValues>

  /**
   * 关联的 scope，默认创建 node 的子 scope。
   */
  scope?: RuntimeDispose
}

/**
 * 创建并挂载 DependencyEffectState 到 RuntimeNode。
 *
 * 会创建 effect state 的 run/dispose 逻辑，并把 renderer 结果经由统一 commit
 * 边界写入 dependency 子树。
 *
 * @param options - 创建 dependency effect 的配置。
 * @returns 已挂载到 node 的 DependencyEffectState。
 */
export function createDependencyEffect<TValues extends Values = Values>(
  options: CreateDependencyEffectOptions<TValues>
): DependencyEffectState {
  // dependency effect 所需的运行时节点与 descriptor。
  const { context, node, descriptor } = options

  // renderer 执行和结果提交所需的运行时能力。
  const { formApi, compile, commitChildren } = context

  // 当前 dependency effect 独占的资源作用域。
  const resourceScope = options.scope ?? node.dispose.child()

  node.effectState?.dispose()

  // renderer 是否正在执行的公开状态。
  const loading = createSignal(false)

  // 最新一次 renderer 执行产生的公开错误状态。
  const error = createSignal<Error | null>(null)

  // renderer 启动或 effect 释放时递增的公开版本状态。
  const version = createSignal(0)

  // 当前 renderer 任务使用的公开 AbortController 状态。
  const abortController = createSignal<AbortController | null>(null)

  node.dependencyDispose = resourceScope

  // 统一管理字段订阅、队列合并、异步取消和最新结果提交。
  const schedulerEffect = createDepSchedulerEffect<TValues, SchemxField<TValues>[]>({
    context,
    triggerFields: descriptor.triggerFields,
    taskId: `dependency:${node.id}:renderer`,
    scope: resourceScope,
    shouldRun: () => {
      // 只在节点仍持有 dependency descriptor 时执行 renderer。
      const currentDescriptor = node.descriptor ?? undefined

      return currentDescriptor != null && isDependencyDescriptor(currentDescriptor)
    },
    run: async (signal) => {
      // 每次任务读取节点上的最新 descriptor，避免使用过期 renderer。
      const currentDescriptor = node.descriptor ?? undefined

      if (!currentDescriptor || !isDependencyDescriptor(currentDescriptor)) {
        return []
      }

      return await Promise.resolve(currentDescriptor.renderer(formApi, signal))
    },
    onStart: (controller) => {
      version.value += 1
      abortController.value = controller
      loading.value = true
      error.value = null
    },
    onSuccess: (childSchemas) => {
      const descriptors = compile.toDescriptors(childSchemas, "")

      commitChildren(node, descriptors)
    },
    onError: (runError) => {
      error.value = runError
    },
    onSettled: () => {
      loading.value = false
    },
  })

  // 手动执行入口复用统一调度 effect 的可中止任务运行器。
  const run = async (): Promise<void> => {
    await schedulerEffect.run()
  }

  // 释放统一调度 effect 和当前 dependency 的父作用域。
  const dispose = (): void => {
    version.value += 1
    schedulerEffect.dispose()
    resourceScope.dispose()
  }

  // 清理节点上仅属于当前 effect 的运行时引用。
  resourceScope.add(() => {
    abortController.value?.abort()
    abortController.value = null

    if (node.effectState?.dispose === dispose) {
      node.effectState = null
    }

    if (node.dependencyDispose === resourceScope) {
      node.dependencyDispose = null
    }
  })

  // 挂载节点可查询的 dependency effect 状态。
  node.effectState = {
    loading,
    error,
    version,
    abortController,
    run,
    dispose,
  }

  return {
    loading,
    error,
    version,
    abortController,
    run,
    dispose,
  }
}
