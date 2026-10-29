/**
 * 与业务模块无关的生命周期钩子和通知接口。
 * @module core/lifecycle/types
 */

/**
 * 由调用方提供的生命周期钩子。
 * @typeParam TPayload - 各阶段携带的数据类型。
 */
export interface LifecycleHooks<TPayload> {
  /**
   * 创建完成时调用。
   * @param payload - 创建完成的数据。
   */
  readonly created?: (payload: TPayload) => void
  /**
   * 挂载完成时调用。
   * @param payload - 挂载完成的数据。
   */
  readonly mounted?: (payload: TPayload) => void
  /**
   * 更新完成时调用。
   * @param payload - 更新后的数据。
   * @param previousPayload - 更新前的数据快照，由调用方提供。
   */
  readonly updated?: (payload: TPayload, previousPayload: TPayload) => void
  /**
   * 卸载完成时调用。
   * @param payload - 卸载完成的数据。
   */
  readonly unmounted?: (payload: TPayload) => void
}

/**
 * 通知对应阶段的钩子，并隔离钩子异常；阶段操作由调用方完成。
 * @typeParam TPayload - 各阶段携带的数据类型。
 */
export interface Lifecycle<TPayload> {
  /**
   * 通知创建完成。
   * @param payload - 创建完成的数据。
   */
  created(payload: TPayload): void
  /**
   * 通知挂载完成。
   * @param payload - 挂载完成的数据。
   */
  mounted(payload: TPayload): void
  /**
   * 通知更新完成。
   * @param payload - 更新后的数据。
   * @param previousPayload - 更新前的数据快照。
   */
  updated(payload: TPayload, previousPayload: TPayload): void
  /**
   * 通知卸载完成。
   * @param payload - 卸载完成的数据。
   */
  unmounted(payload: TPayload): void
}
