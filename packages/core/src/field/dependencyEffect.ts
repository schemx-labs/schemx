/**
 * DependencyEffect - dependency renderer 执行态容器。
 *
 * Slot 只记录异步执行状态。renderer 返回的结构由 reconciler 写入
 * DependencyRuntimeNode.dynamicChildNodes。
 *
 * @module core/field/dependencyEffect
 */

import { compileToDescriptors } from "../descriptor"
import { createSignal, createSignalEffect } from "../reactivity"

import type { SchemxFormContext } from "../createForm"
import type { DependencyDescriptor } from "../descriptor"
import type { DependencyRuntimeNode, Scope } from "../node"
import type { Signal } from "../reactivity"
import type { NamePath, SchemxFormApi, Values } from "../types"

/**
 * 检查 DependencyRuntimeNode 是否有 DependencySlot。
 *
 * @param node - dependency runtime 节点。
 * @returns 已挂载 slot 时返回 true。
 */
export function hasDependencySlot(node: DependencyRuntimeNode): boolean {
  return node.dependencySlot != null
}

/**
 * 从 DependencyRuntimeNode 获取 DependencySlot。
 *
 * @param node - dependency runtime 节点。
 * @returns 当前 slot；尚未挂载时返回 undefined。
 */
export function getDependencySlot(
  node: DependencyRuntimeNode
): DependencyEffectSlot | undefined {
  return node.dependencySlot ?? undefined
}

/**
 * Dependency renderer 的执行状态与控制句柄。
 */
export interface DependencyEffectSlot {
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
  scope?: Scope

  /**
   * 表单内部上下文。
   */
  context: SchemxFormContext<TValues>
}

/**
 * 创建并挂载 DependencyEffectSlot 到 RuntimeNode。
 *
 * 会创建 slot 的 run/dispose 逻辑，并把 renderer 结果经由统一 commit 边界写入
 * dependency 子树。
 *
 * @param options - 创建 dependency effect 的配置。
 * @returns 已挂载到 node 的 DependencyEffectSlot。
 */
export function createDependencyEffect<TValues extends Values = Values>(
  options: CreateDependencyEffectOptions<TValues>
): DependencyEffectSlot {
  const { node, descriptor, context } = options
  const resourceScope = options.scope ?? node.scope.child()

  node.dependencySlot?.dispose()

  const slot: DependencyEffectSlot = {
    loading: createSignal(false),
    error: createSignal<Error | null>(null),
    version: createSignal(0),
    abortController: createSignal<AbortController | null>(null),
    run: async (): Promise<void> => undefined,
    dispose: (): void => undefined,
  }

  node.dependencyResourceScope = resourceScope

  slot.run = (): Promise<void> => {
    if (resourceScope.disposed) return Promise.resolve()

    const currentDescriptor = node.descriptor

    const currentVersion = slot.version.value + 1
    slot.version.value = currentVersion

    slot.abortController.value?.abort()
    const controller = new AbortController()
    slot.abortController.value = controller

    slot.loading.value = true
    slot.error.value = null

    return context.scheduler.track(
      (async () => {
        try {
          const childSchemas = await Promise.resolve(
            currentDescriptor.renderer(context.formApi, controller.signal)
          )

          if (
            resourceScope.disposed ||
            controller.signal.aborted ||
            currentVersion !== slot.version.value
          ) {
            return
          }

          const descriptors = compileToDescriptors<TValues>(
            childSchemas,
            context.defaultProps
          )

          context.commitChildren(node, descriptors)
        } catch (cause) {
          if (
            resourceScope.disposed ||
            controller.signal.aborted ||
            currentVersion !== slot.version.value
          ) {
            return
          }

          slot.error.value = normalizeError(cause)
        } finally {
          if (
            !resourceScope.disposed &&
            !controller.signal.aborted &&
            currentVersion === slot.version.value
          ) {
            slot.loading.value = false
          }
        }
      })()
    )
  }

  slot.dispose = (): void => {
    slot.version.value += 1
    slot.abortController.value?.abort()
    resourceScope.dispose()
  }

  resourceScope.add(() => {
    slot.abortController.value?.abort()
    slot.abortController.value = null

    if (node.dependencySlot === slot) {
      node.dependencySlot = null
    }

    if (node.dependencyResourceScope === resourceScope) {
      node.dependencyResourceScope = null
    }
  })

  if (descriptor.trigger.length > 0) {
    setupTriggerSubscription(
      descriptor.trigger,
      context.formApi,
      () => slot.run(),
      resourceScope
    )
  }

  node.dependencySlot = slot

  void slot.run().catch((runError) => {
    console.error("DependencyEffectSlot initial run error:", runError)
  })

  return slot
}

/**
 * 设置 trigger 字段监听。
 */
function setupTriggerSubscription<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  triggers: TName[],
  formApi: SchemxFormApi<TValues>,
  run: () => Promise<void>,
  scope: { disposed: boolean; add: (cleanup: () => void) => void }
): void {
  let isFirstRun = true
  let pendingRun = false

  const disposeEffect = createSignalEffect(() => {
    void formApi.getValues(triggers)

    if (!isFirstRun && !pendingRun) {
      pendingRun = true

      queueMicrotask(() => {
        pendingRun = false

        if (scope.disposed) return

        run().catch((runError) => {
          console.error("DependencyEffectSlot trigger run error:", runError)
        })
      })
    }

    isFirstRun = false
  })

  scope.add(disposeEffect)
}

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
