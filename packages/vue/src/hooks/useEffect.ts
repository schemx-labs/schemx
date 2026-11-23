/**
 * useEffect - Vue 组合式 API 版本的 Signal effect
 *
 * 封装 `@schemx/core` 的 `createEffect`，在组件卸载时自动 dispose，
 * 无需手动管理生命周期。
 *
 * @module hooks/useEffect
 *
 * @example
 * ```ts
 * import { useEffect } from '@schemx/vue'
 *
 * // 在 setup 中使用
 * useEffect(() => {
 *   const name = form.getFieldValue('name')
 *   console.log('name:', name)
 *
 *   return () => {
 *     // 清理逻辑
 *   }
 * })
 * ```
 */

import { onUnmounted } from "vue"

import { createEffect } from "@schemx/core"

import type { CreateEffectReturn, EffectCallback } from "@schemx/core"

/**
 * 创建 Signal effect 并在组件卸载时自动取消。
 *
 * 在 effect 回调中访问任何 Signal 值时自动追踪依赖，
 * 依赖变化时自动重新执行回调。
 * 回调可返回一个清理函数，在 effect 重新执行前或被 dispose 时调用。
 *
 * @param callback - effect 回调函数，可选返回清理函数
 *
 * @returns 取消 effect 的 dispose 函数（通常无需手动调用，组件卸载时自动取消）
 *
 * @example
 * ```ts
 * // 监听字段值变化
 * useEffect(() => {
 *   const name = form.getFieldValue('name')
 *   console.log('name changed:', name)
 * })
 *
 * // 带清理函数
 * useEffect(() => {
 *   const timer = setInterval(() => {
 *     console.log('value:', form.getFieldValue('count'))
 *   }, 1000)
 *
 *   return () => clearInterval(timer)
 * })
 * ```
 */
export function useEffect(callback: EffectCallback): CreateEffectReturn {
  const dispose = createEffect(callback)

  onUnmounted(dispose)

  return dispose
}

export default useEffect
