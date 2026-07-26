/**
 * subscribeViewSchemas - ViewSchemas 订阅机制。
 *
 * 使用 debounced signal effect 追踪 root viewSchemas computed 的依赖变化，
 * 自动通知外部回调。渲染层通过此函数监听表单结构的实时变更。
 *
 * @module core/view/subscribeViewSchemas
 */
import { createDebouncedSignalEffect } from "../reactivity"

import type { RootRuntimeNode, RuntimeNodeResourceContext } from "../node"
import type { Values } from "../types"
import type { RootViewState, RuntimeViewState } from "./createViewState"
import type { SchemxViewSchema } from "./types"

/**
 * 订阅 ViewSchemas 变化。
 *
 * 注册一个 debounced effect 监听 root viewSchemas computed 的值变化，
 * 变化时通过 onChange 回调通知调用方。返回的取消函数可停止订阅。
 *
 * @param root - root runtime 节点。
 * @param _resources - 运行时资源上下文（当前未使用，保留接口一致性）。
 * @param onChange - ViewSchemas 变化时的回调，接收最新的 schema 列表。
 * @returns 取消订阅函数，调用后停止监听。
 */
export function subscribeViewSchemas<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues>,
  _resources: RuntimeNodeResourceContext<TValues>,
  onChange: (schemas: readonly SchemxViewSchema<TValues>[]) => void
): () => void {
  // 标记 root 是否已销毁，避免销毁后仍然读取 viewState 触发脏数据
  let rootDisposed = false

  // 在 root 的 dispose scope 中注册销毁标记回调
  const rootScope = root.dispose

  const disposeHandle = rootScope.add(() => {
    rootDisposed = true
  })

  // 创建 debounced effect：读取 viewSchemas.value 时会自动收集依赖，
  // 值变化后以 16ms 防抖间隔通知 onChange
  const disposeEffect = createDebouncedSignalEffect(
    () => {
      if (rootDisposed) {
        return []
      }

      const rootViewState = (
        root as RootRuntimeNode<TValues> & {
          readonly viewState?: RootViewState<TValues> | null
        }
      ).viewState

      return isRootViewState(rootViewState) ? rootViewState.viewSchemas.value : []
    },
    (viewSchemas) => {
      try {
        onChange(viewSchemas)
      } catch (error) {
        console.error("[subscribeViewSchemas] onChange error:", error)
      }
    },
    16,
    { immediate: true, edges: ["leading", "trailing"] }
  )

  /**
   * 取消订阅，清理 effect 和 scope 注册。
   */
  const unsubscribe = (): void => {
    disposeEffect()
    disposeHandle.dispose()
    rootDisposed = false
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
