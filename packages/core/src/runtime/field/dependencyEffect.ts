/**
 * DependencyEffect - dependency renderer 执行态容器。
 *
 * Effect state 只记录异步执行状态。renderer 返回的结构由 reconciler 写入
 * DependencyRuntimeNode.childNodes。
 *
 * @module core/runtime/field/dependencyEffect
 */

import { createSignal, createSignalEffect } from "../../reactivity"
import { type DependencyDescriptor, isDependencyDescriptor } from "../descriptor"
import { createAbortableTaskRunner } from "../scheduler/abortableTaskRunner"

import type { Signal } from "../../reactivity"
import type { NamePath, SchemxField, SchemxFormApi, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { DependencyRuntimeNode, RuntimeDispose } from "../node"
import type { Scheduler } from "../scheduler"

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
  readonly loading: Signal<boolean>
  readonly error: Signal<Error | null>
  readonly version: Signal<number>
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
  const { context, node, descriptor } = options

  const { formApi, scheduler, compile, commitChildren } = context

  const resourceScope = options.scope ?? node.dispose.child()

  node.effectState?.dispose()

  const effectState: DependencyEffectState = {
    loading: createSignal(false),
    error: createSignal<Error | null>(null),
    version: createSignal(0),
    abortController: createSignal<AbortController | null>(null),
    run: async (): Promise<void> => undefined,
    dispose: (): void => undefined,
  }

  node.effectState = effectState
  node.dependencyDispose = resourceScope

  const taskRunner = createAbortableTaskRunner<SchemxField<TValues>[]>({
    scope: resourceScope,
    scheduler,
    run: async (signal) => {
      const currentDescriptor = node.descriptor ?? undefined

      if (!currentDescriptor || !isDependencyDescriptor(currentDescriptor)) {
        return []
      }

      return await Promise.resolve(currentDescriptor.renderer(formApi, signal))
    },
    onStart: (controller) => {
      effectState.version.value += 1
      effectState.abortController.value = controller
      effectState.loading.value = true
      effectState.error.value = null
    },
    onSuccess: (childSchemas) => {
      const descriptors = compile.toDescriptors(childSchemas, "")

      commitChildren(node, descriptors)
    },
    onError: (error) => {
      effectState.error.value = error
    },
    onSettled: () => {
      effectState.loading.value = false
    },
  })

  effectState.run = async (): Promise<void> => {
    if (resourceScope.disposed) return

    const currentDescriptor = node.descriptor ?? undefined

    if (!currentDescriptor || !isDependencyDescriptor(currentDescriptor)) {
      return
    }

    await taskRunner.run()
  }

  effectState.dispose = (): void => {
    effectState.version.value += 1
    taskRunner.dispose()
    resourceScope.dispose()
  }

  resourceScope.add(() => {
    effectState.abortController.value?.abort()
    effectState.abortController.value = null

    if (node.effectState === effectState) {
      node.effectState = null
    }

    if (node.dependencyDispose === resourceScope) {
      node.dependencyDispose = null
    }
  })

  setupTriggerSubscription(
    descriptor.triggerFields,
    formApi,
    () => effectState.run(),
    resourceScope,
    scheduler,
    `dependency:${node.id}:trigger`
  )

  void effectState.run().catch((runError) => {
    console.error("DependencyEffectState initial run error:", runError)
  })

  return effectState
}

/**
 * 设置 trigger 字段的响应式监听。
 *
 * 通过 createSignalEffect 订阅 trigger 字段值变化，
 * 首次执行跳过调度，后续变化通过 scheduler 调度异步执行 renderer。
 * 监听生命周期绑定到 resourceScope，随 scope 释放自动清理。
 *
 * @typeParam TValues - 表单值类型
 * @typeParam TName - trigger 字段的 name path 类型
 * @param triggers - 触发字段名列表
 * @param formApi - 表单 API
 * @param run - 执行 renderer 的回调
 * @param scope - 资源作用域
 * @param scheduler - 任务调度器
 * @param taskId - 调度任务 ID
 */
function setupTriggerSubscription<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  triggers: readonly TName[],
  formApi: SchemxFormApi<TValues>,
  run: () => Promise<void>,
  scope: RuntimeDispose,
  scheduler: Scheduler,
  taskId: string
): void {
  let isFirstRun = true

  const disposeEffect = createSignalEffect(() => {
    void formApi.getValues([...triggers])

    if (!isFirstRun) {
      scheduler.schedule({
        id: taskId,
        priority: "normal",
        scope,
        run,
        onError: (runError) => {
          console.error("DependencyEffectState trigger run error:", runError)
        },
      })
    }

    isFirstRun = false
  })

  scope.add(disposeEffect)
}
