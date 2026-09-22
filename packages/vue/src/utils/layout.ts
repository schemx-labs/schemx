/**
 * Vue 布局间距工具。
 *
 * @module utils/layout
 */

import type { SchemxGutter } from "../types/layout"

/** 归一化后的上、右、下、左间距。 */
export type SchemxNormalizedGutter = readonly [number, number, number, number]

/**
 * 将 CSS padding shorthand 形式的 gutter 归一化为四边值。
 *
 * @param gutter - 单值、上下/左右二元组或上/右/下/左四元组。
 * @returns 上、右、下、左四边值。
 *
 * @example
 * ```ts
 * normalizeSchemxGutter(8) // => [8, 8, 8, 8]
 * normalizeSchemxGutter([4, 12]) // => [4, 12, 4, 12]
 * ```
 */
export function normalizeSchemxGutter(
  gutter: SchemxGutter | undefined
): SchemxNormalizedGutter {
  if (gutter === undefined) {
    return [0, 0, 0, 0]
  }

  if (typeof gutter === "number") {
    return [gutter, gutter, gutter, gutter]
  }

  if (gutter.length === 2) {
    const [vertical, horizontal] = gutter

    return [vertical, horizontal, vertical, horizontal]
  }

  return gutter
}
