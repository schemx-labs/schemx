import { joinDynamicPath } from "./paths"

import type { CreateDynamicRowOptions } from "../compiler"
import type { DynamicRowState } from "../node/types"

/**
 * 根据 Store 行 key 关联 Runtime 身份所需的输入。
 */
export interface ReconcileRowsOptions {
  /**
   * 上一次提交的行身份和位置，不包含字段值。
   */
  readonly previous: readonly DynamicRowState[]
  /**
   * Store 已协调好的稳定行 key，顺序与当前数组一致。
   */
  readonly keys: readonly string[]
  /**
   * 当前数组根的数据路径。
   */
  readonly path: string
  /**
   * 创建新行的 Compiler 工厂，已有行只更新位置。
   * @param options - 新行的 Store key 和当前完整位置。
   */
  readonly createRow: (options: CreateDynamicRowOptions) => DynamicRowState
}

/**
 * 只按 Store 行 key 复用身份，不再按数组项值进行第二次匹配。
 * @param options - 已提交行、Store key、数组路径和 Compiler 行工厂。
 * @returns 与 Store 当前顺序一致的行结构。
 * @example
 * const rows = reconcileRows({ previous: [], keys: ["fa_1"], path: "users", createRow: compiler.createDynamicRow })
 */
export function reconcileRows(options: ReconcileRowsOptions): DynamicRowState[] {
  // row 是本容器上一轮的行，每个 Dynamic 独立匹配 key。
  const previousByKey = new Map(options.previous.map((row) => [row.key, row]))

  // key 来自 Store，index 是本次提交后的数组位置。
  return options.keys.map((key, index) => {
    // 当前行位置不包含身份分配能力。
    const location = { key, index, path: joinDynamicPath(options.path, String(index)) }

    // 同 key 复用既有身份；只有新行才调用 Compiler 工厂。
    const previous = previousByKey.get(key)

    return previous ? { ...location, id: previous.id } : options.createRow(location)
  })
}
