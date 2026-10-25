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
export function withLock<TFunction extends (...args: any[]) => Promise<any>>(
  fn: TFunction
): TFunction {
  let pending: Promise<any> | null = null

  return ((...args: any[]) => {
    if (pending) return pending

    pending = fn(...args).finally(() => {
      pending = null
    })

    return pending
  }) as TFunction
}
