/**
 * 异步工具函数
 *
 * @module utils/async
 *
 * @example
 * ```ts
 * import { withLock, waitAll } from '@schemx/core'
 *
 * // 使用 withLock 防止重复提交
 * const submit = withLock(async (data) => {
 *   await api.post('/submit', data)
 * })
 *
 * // 多次调用只会执行一次
 * submit(data1)
 * submit(data2) // 复用第一个 Promise
 *
 * // 使用 waitAll 等待多个 Promise，带超时
 * const promises = [fetch('/a'), fetch('/b'), fetch('/c')]
 * const result = await waitAll(promises, 5000)
 *
 * console.log('已完成:', result.results)
 * console.log('未完成:', result.remaining)
 * ```
 */

/**
 * 等待所有 Promise 完成或超时
 *
 * 当所有 Promise 在超时前完成后立即返回，
 * 超时后返回已完成的结果和剩余未完成数。
 *
 * @param promises - Promise 数组
 * @param timeout - 超时时间（毫秒），默认 10000
 * @returns 包含结果和剩余未完成数的对象
 *
 * @example
 * ```ts
 * // 正常情况：所有都完成
 * const promises = [
 *   Promise.resolve(1),
 *   Promise.resolve(2),
 *   Promise.resolve(3)
 * ]
 * const result = await waitAll(promises)
 * // result => { results: [1, 2, 3], remaining: 0 }
 *
 * // 超时情况：部分完成
 * const slowPromises = [
 *   Promise.resolve('fast'),
 *   new Promise(resolve => setTimeout(() => resolve('slow'), 2000))
 * ]
 * const result2 = await waitAll(slowPromises, 1000)
 * // result2 => { results: ['fast', undefined], remaining: 1 }
 *
 * // 空数组
 * const result3 = await waitAll([])
 * // result3 => { results: [], remaining: 0 }
 * ```
 */
export async function waitAll<T>(
  promises: Promise<T>[],
  timeout: number = 10000
): Promise<{ results: T[]; remaining: number }> {
  if (promises.length === 0) {
    return { results: [], remaining: 0 }
  }

  const results: T[] = []
  let completed = 0
  const total = promises.length

  await Promise.race([
    Promise.allSettled(
      promises.map(async (p, i) => {
        try {
          results[i] = await p
        } catch {
          // 不在这里处理错误，让调用方自行处理
        }

        completed++
      })
    ),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, timeout)
    }),
  ])

  return {
    results,
    remaining: total - completed,
  }
}

/**
 * 创建一个带锁的异步函数。
 *
 * 当函数正在执行时，重复调用会直接返回同一个 Promise；
 * 执行完成后自动释放锁，下次调用重新执行。
 *
 * @param fn - 要加锁的异步函数
 * @returns 加锁后的函数
 *
 * @remarks
 * 返回函数会透传原函数参数；并发期间的后续调用会共享第一次调用的 Promise。
 *
 * @example
 * ```typescript
 * const lockedSubmit = withLock(async () => {
 *   await api.submit(data)
 * })
 *
 * lockedSubmit()
 * lockedSubmit() // 复用上一次的 Promise
 * ```
 */
export function withLock<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  let pending: Promise<any> | null = null

  return ((...args: any[]) => {
    if (pending) return pending

    pending = fn(...args).finally(() => {
      pending = null
    })

    return pending
  }) as T
}
