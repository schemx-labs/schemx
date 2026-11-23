/**
 * subscribeViewSchemas - ViewSchemas 订阅机制。
 *
 * 使用 createSignalEffect 追踪依赖变化，自动重新构建 ViewSchemas。
 *
 * @module core/view/subscribeViewSchemas
 */
import { createDebouncedSignalEffect } from "../reactivity"

import { buildViewSchemas } from "./buildViewSchemas"

import type { RootRuntimeNode } from "../node"
import type { Values } from "../types"
import type { SchemxViewSchema } from "./types"
import type { ViewRevision } from "./viewRevision"

/**
 * 订阅 ViewSchemas 变化。
 *
 * @param root - root runtime 节点。
 * @param revision - 视图结构版本追踪器。
 * @param onChange - ViewSchemas 变化回调。
 * @returns 取消订阅函数。
 */
export function subscribeViewSchemas<TValues extends Values = Values>(
  root: RootRuntimeNode<TValues>,
  revision: ViewRevision,
  onChange: (schemas: readonly SchemxViewSchema<TValues>[]) => void
): () => void {
  let rootDisposed = false

  const rootScope = root.scope
  const disposeHandle = rootScope.add(() => {
    rootDisposed = true
  })

  const disposeEffect = createDebouncedSignalEffect(
    () => {
      void revision.revision.value

      return rootDisposed ? [] : buildViewSchemas<TValues>(root)
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

  const unsubscribe = (): void => {
    disposeEffect()
    disposeHandle.dispose()
    rootDisposed = false
  }

  return unsubscribe
}
