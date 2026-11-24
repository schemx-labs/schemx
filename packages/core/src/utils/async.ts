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
export function withLock<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  // 执行期间所有调用共享的完成句柄。
  let pending: Promise<TResult> | undefined

  // args 为首次执行时传入的参数，并发调用只读取当前句柄。
  return (...args) => {
    if (pending) return pending

    // 先登记完成句柄，再同步开始工作，以覆盖业务回调的同步重入。
    let start = (): void => {}

    // resolve 和 reject 交付本次原函数的结果。
    const result = new Promise<TResult>((resolve, reject) => {
      start = () => {
        try {
          resolve(fn(...args))
        } catch (error) {
          reject(error)
        }
      }
    })

    // 共享结果在通知调用方前释放锁。
    const shared = result.finally(() => {
      pending = undefined
    })

    pending = shared
    start()

    return shared
  }
}
