/**
 * 依赖任务调度 effect 创建器。
 *
 * @module core/runtime/dependencySchedulerEffect/createDepSchedulerEffect
 */

import { createSignalEffect, runUntracked } from "../../reactivity"
import { createAbortableTaskRunner } from "../scheduler/abortableTaskRunner"

import type { NamePath, Values } from "../../types"
import type { SchemaRuntimeContext } from "../context"
import type { Scope } from "../node"

/**
 * 依赖任务调度 effect 的控制句柄。
 *
 * @typeParam TResult - 依赖任务成功完成时产生的结果类型。
 */
export interface DepSchedulerEffect<TResult> {
  /**
   * 立即执行一次依赖任务。
   *
   * 本次执行会中止仍在运行的旧任务，并遵循最新结果优先规则。
   *
   * @returns 最新任务结果；effect 已释放、任务被跳过或执行失败时返回 `undefined`。
   */
  readonly run: () => Promise<TResult | undefined>

  /**
   * 释放字段订阅并中止当前任务。
   */
  readonly dispose: () => void
}

/**
 * 创建依赖任务调度 effect 的配置。
 *
 * @typeParam TValues - 当前表单值类型。
 * @typeParam TResult - 依赖任务成功完成时产生的结果类型。
 */
export interface CreateDepSchedulerEffectOptions<TValues extends Values, TResult> {
  /**
   * 提供字段读取与任务调度能力的运行时上下文。
   */
  readonly context: SchemaRuntimeContext<TValues>

  /**
   * 本 effect 实际订阅的字段路径。
   */
  readonly triggerFields: readonly NamePath<TValues>[]

  /**
   * Scheduler 队列中用于合并重复任务的唯一标识。
   *
   * 同一轮调度中使用相同标识的任务只保留最后一次。
   */
  readonly taskId: string

  /**
   * effect 所属的父生命周期作用域。
   */
  readonly scope: Scope

  /**
   * effect 建立时是否立即执行一次任务。
   *
   * @defaultValue `true`
   */
  readonly immediate?: boolean

  /**
   * 执行任务前的可选守卫。
   *
   * 返回 `false` 时跳过本次任务，且不会创建新的 AbortController。
   */
  readonly shouldRun?: () => boolean

  /**
   * 实际执行的同步或异步依赖任务。
   *
   * @param signal - 本次任务的中止信号。
   * @returns 当前依赖任务的计算结果。
   */
  readonly run: (signal: AbortSignal) => TResult | Promise<TResult>

  /**
   * 新任务创建 AbortController 后触发的回调。
   *
   * @param controller - 本次任务使用的 AbortController。
   */
  readonly onStart?: (controller: AbortController) => void

  /**
   * 最新任务成功完成后触发的回调。
   *
   * @param result - 最新任务产生的结果。
   */
  readonly onSuccess?: (result: TResult) => void

  /**
   * 最新任务执行失败后触发的回调。
   *
   * @param error - 已规范化的任务错误。
   */
  readonly onError?: (error: Error) => void

  /**
   * 最新任务成功或失败后触发的回调。
   */
  readonly onSettled?: () => void
}

/**
 * 创建依赖字段驱动的可中止任务 effect。
 *
 * effect 首次建立时按 `immediate` 决定是否直接执行任务；后续触发字段变化
 * 会进入 Scheduler 的 `normal` 队列，并通过 `taskId` 合并同一轮重复调度。
 *
 * @typeParam TValues - 当前表单值类型。
 * @typeParam TResult - 依赖任务成功完成时产生的结果类型。
 * @param options - 字段订阅、任务实现、生命周期回调和调度配置。
 * @returns 可手动执行或释放的依赖任务 effect。
 *
 * @remarks
 * 仅 `triggerFields` 的读取会进入响应式追踪。任务实现和生命周期回调均在
 * 非追踪上下文中执行，不会意外扩大字段订阅范围。
 */
export function createDepSchedulerEffect<TValues extends Values, TResult>(
  options: CreateDepSchedulerEffectOptions<TValues, TResult>
): DepSchedulerEffect<TResult> {
  // 当前 effect 独占的生命周期作用域。
  const effectScope = options.scope.child()

  // 依赖任务所需的字段读取接口与 Scheduler。
  const { formApi, scheduler } = options.context

  // 管理异步任务取消、最新结果判定和 Scheduler 空闲状态。
  const taskRunner = createAbortableTaskRunner<TResult>({
    scope: effectScope,
    scheduler,
    run: options.run,
    onStart: options.onStart,
    onSuccess: options.onSuccess,
    onError: options.onError,
    onSettled: options.onSettled,
  })

  // 立即执行任务，并在执行前检查生命周期与业务守卫。
  const run = async (): Promise<TResult | undefined> => {
    if (effectScope.disposed || options.shouldRun?.() === false) {
      return
    }

    return await taskRunner.run()
  }

  // 将后续字段变化合并到 Scheduler 的 normal 队列。
  const schedule = (): void => {
    scheduler.schedule({
      id: options.taskId,
      priority: "normal",
      scope: effectScope,
      run: () => {
        // taskRunner 已自行注册异步任务，队列任务无需重复返回同一 Promise。
        void run()
      },
    })
  }

  if (options.triggerFields.length > 0) {
    // 标记响应式 effect 是否已完成首次依赖收集。
    let initialized = false

    // 仅订阅明确声明的触发字段。
    const disposeSubscription = createSignalEffect(() => {
      void formApi.getValues([...options.triggerFields])

      if (!initialized) {
        initialized = true

        if (options.immediate !== false) {
          // 首次任务直接执行，以保持依赖资源挂载后的初始化时机。
          runUntracked(() => {
            void run()
          })
        }

        return
      }

      // 调度过程不应把任务内部读取的字段纳入当前 effect。
      runUntracked(schedule)
    })

    effectScope.add(disposeSubscription)
  }

  // 释放当前 effect 的订阅和任务子作用域。
  const dispose = (): void => {
    effectScope.dispose()
  }

  return {
    run,
    dispose,
  }
}
