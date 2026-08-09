/**
 * subscribeViewSchemas - ViewSchemas 订阅机制。
 *
 * 使用 debounced signal effect 追踪 root viewSchemas computed 的依赖变化，
 * 自动通知外部回调。渲染层通过此函数监听表单结构的实时变更。
 *
 * @module core/runtime/view/subscribeViewSchemas
 */
import { createDebouncedSignalWatch } from "../../reactivity"

import type { Values } from "../../types"
import type { RootRuntimeNode } from "../node"
import type { RootViewState, RuntimeViewState } from "./createViewState"
import type { SchemxViewSchema } from "./types"

/**
 * 订阅 ViewSchemas 变化。
 *
 * 注册一个 debounced watch 监听 root viewSchemas computed 的值变化，
 * 变化时通过 onChange 回调通知调用方。返回的取消函数可停止订阅。
 *
 * @param root - root runtime 节点。
 * @param onChange - ViewSchemas 变化时的回调，接收最新的 schema 列表。
 * @returns 取消订阅函数，调用后停止监听。
 */
export function subscribeViewSchemas<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues>,
  onChange: (schemas: readonly SchemxViewSchema<TValues>[]) => void
): () => void {
  // 值变化后以 16ms 防抖间隔通知 onChange
  const disposeWatch = createDebouncedSignalWatch(
    () => {
      const rootViewState = root.viewState

      return isRootViewState(rootViewState) ? rootViewState.viewSchemas.value : []
    },
    (viewSchemas) => {
      try {
        onChange(viewSchemas)
      } catch (error) {
        console.error("[schemx] viewSchemas 订阅回调执行错误", error)
      }
    },
    { immediate: true, edges: ["leading", "trailing"] }
  )

  // Root scope 拥有 watch；Runtime 销毁时无需调用方额外 unsubscribe。
  const disposeHandle = root.dispose.add(disposeWatch.dispose)

  /**
   * 取消订阅，并从 Root scope 提前释放 watch。
   */
  const unsubscribe = (): void => {
    disposeHandle.dispose()
  }

  return unsubscribe
}

/**
 * 类型守卫：判断 viewState 是否为 RootViewState。
 *
 * @param viewState - 待检查的运行时视图状态。
 * @returns 如果包含 viewSchemas 属性则判定为 RootViewState。
 */
function isRootViewState<TValues extends Values>(
  viewState: RuntimeViewState<TValues> | null | undefined
): viewState is RootViewState<TValues> {
  return viewState != null && "viewSchemas" in viewState
}
