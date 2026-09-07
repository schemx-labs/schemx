/**
 * 创建严格单例工厂
 *
 * 确保 factory 只执行一次，后续调用返回同一实例。
 * reset 仅在非生产环境可用。
 *
 * @param factory - 创建实例的工厂函数
 *
 * @example
 * ```typescript
 * // 基础用法
 * const singleton = createStrictSingleton(() => new DatabaseConnection())
 * const db = singleton.getInstance() // 创建实例
 * const db2 = singleton.getInstance() // 返回同一实例，db === db2
 *
 * // 带参数的工厂
 * const singleton = createStrictSingleton((host: string, port: number) => {
 *   return new RedisClient(host, port)
 * })
 * const client = singleton.getInstance('localhost', 6379) // 首次调用，创建实例
 * const client2 = singleton.getInstance('other', 9999) // 忽略参数，返回同一实例
 *
 * // 测试环境重置
 * singleton.reset() // 仅非生产环境可用
 * const fresh = singleton.getInstance('localhost', 6379) // 重新创建
 * ```
 */
export function createStrictSingleton<TValue, TArgs extends any[] = []>(
  factory: (...args: TArgs) => TValue
) {
  // 首次成功访问时创建并缓存的单例实例。
  let instance: TValue | undefined

  // 标记工厂是否已经创建过单例实例。
  let initialized = false

  /**
   * 返回当前单例；首次调用时执行外部 factory。
   */
  const getInstance = (...args: TArgs): TValue => {
    if (!initialized) {
      instance = factory(...args)

      if (instance == null) {
        throw new Error("[Singleton] factory 不能返回 null 或 undefined")
      }

      initialized = true
    }

    return instance as TValue
  }

  /**
   * 重置单例状态；生产环境只告警并跳过。
   */
  const reset = (): void => {
    try {
      const processEnvironment = (
        globalThis as { process?: { env?: { NODE_ENV?: string } } }
      ).process?.env

      if (processEnvironment?.NODE_ENV === "production") {
        console.warn("[schemx] reset() 不应在生产环境调用")

        return
      }
    } catch {
      // 不支持 process 的环境直接重置单例，不执行环境检查。
    }

    instance = undefined
    initialized = false
  }

  return Object.freeze({
    getInstance,
    reset,
  })
}
