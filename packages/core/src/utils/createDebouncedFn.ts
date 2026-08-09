import { debounce } from "es-toolkit"

/**
 * Debounce 执行边缘。
 */
export type DebounceEdge = "leading" | "trailing"

/**
 * Debounce 函数配置。
 */
export interface DebouncedFnOptions {
  /**
   * debounce 等待时间。
   *
   * @default 16
   */
  wait?: number

  /**
   * callback 的执行边缘。
   *
   * @default ["trailing"]
   */
  edges?: DebounceEdge[]
}

/**
 * Debounce 函数控制器。
 */
export interface DebouncedFnControls<TArgs extends unknown[]> {
  /**
   * 调度执行 callback。
   */
  run: (...args: TArgs) => void

  /**
   * 取消当前尚未执行的 callback。
   */
  cancel: () => void

  /**
   * 立即执行当前等待中的 callback。
   */
  flush: () => void
}

/**
 * 创建带控制能力的 debounce 函数。
 *
 * @typeParam TArgs - callback 参数类型。
 *
 * @param fn - debounce callback。
 * @param options - debounce 配置。
 *
 * @returns debounce 控制器。
 *
 * @example
 * ```ts
 * const {
 *   run,
 *   cancel,
 *   flush,
 * } = createDebouncedFn(
 *   value => {
 *     console.log(value)
 *   },
 *   {
 *     wait: 300,
 *   }
 * )
 *
 * run("foo")
 * run("bar")
 * ```
 */
export function createDebouncedFn<TArgs extends unknown[]>(
  fn: (...args: TArgs) => unknown,
  options: DebouncedFnOptions = {}
): DebouncedFnControls<TArgs> {
  const { wait = 16, edges = ["trailing"] } = options

  const debounced = debounce(fn, wait, {
    edges,
  })

  return {
    run: (...args) => {
      debounced(...args)
    },

    cancel: () => {
      debounced.cancel()
    },

    flush: () => {
      debounced.flush()
    },
  }
}
