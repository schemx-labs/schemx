/**
 * 通用生命周期钩子通知，不执行调用方的资源或状态操作。
 * @module core/lifecycle/createLifecycle
 */

import type { Lifecycle, LifecycleHooks } from "./types"

/**
 * 创建生命周期通知入口，并隔离业务钩子抛出的异常。
 * @typeParam TPayload - 各阶段携带的数据类型。
 * @param hooks - 调用方提供的阶段钩子；缺省时通知不执行任何操作。
 * @returns 创建、挂载、更新和卸载的通知入口。
 * @example
 * const lifecycle = createLifecycle<string>({ mounted: (value) => console.log(value) })
 * lifecycle.mounted("ready")
 */
export function createLifecycle<TPayload>(
  hooks: LifecycleHooks<TPayload> = {}
): Lifecycle<TPayload> {
  /**
   * 调用钩子并隔离异常，避免中断调用方的后续处理。
   * @typeParam TArgs - 钩子接收的参数元组。
   * @param hook - 当前阶段的钩子；未提供时跳过。
   * @param args - 当前阶段携带的数据。
   */
  const notify = <TArgs extends unknown[]>(
    hook: ((...args: TArgs) => void) | undefined,
    ...args: TArgs
  ): void => {
    if (!hook) {
      return
    }

    try {
      hook(...args)
    } catch (error) {
      console.error("[schemx] Lifecycle hook 执行错误", error)
    }
  }

  /**
   * 通知创建完成。
   * @param payload - 创建完成的数据。
   * @example lifecycle.created(value)
   */
  const created = (payload: TPayload): void => {
    notify(hooks.created, payload)
  }

  /**
   * 通知挂载完成。
   * @param payload - 挂载完成的数据。
   * @example lifecycle.mounted(value)
   */
  const mounted = (payload: TPayload): void => {
    notify(hooks.mounted, payload)
  }

  /**
   * 通知更新完成。
   * @param payload - 更新后的数据。
   * @param previousPayload - 更新前的数据快照。
   * @example lifecycle.updated(value, previousValue)
   */
  const updated = (payload: TPayload, previousPayload: TPayload): void => {
    notify(hooks.updated, payload, previousPayload)
  }

  /**
   * 通知卸载完成。
   * @param payload - 卸载完成的数据。
   * @example lifecycle.unmounted(value)
   */
  const unmounted = (payload: TPayload): void => {
    notify(hooks.unmounted, payload)
  }

  return { created, mounted, updated, unmounted }
}
