import type { DynamicRowState } from "../node/types"

// 行上下文随原始 Schema 回收，不写入业务配置或依赖字符串编码。
const schemaRows = new WeakMap<object, DynamicRowState>()

/**
 * 将展开后的 Dependency Schema 关联到当前行快照。
 * @param schema - 新生成的 Dependency Schema。
 * @param row - 当前稳定行身份和位置；后续移动通过新快照替换。
 * @example attachDynamicRow(schema, row)
 */
export function attachDynamicRow(schema: object, row: DynamicRowState): void {
  schemaRows.set(schema, row)
}

/**
 * 读取 Schema 对应的行上下文，普通 Schema 返回 undefined。
 * @param schema - Compiler 或重定位逻辑正在处理的原始 Schema。
 * @example const row = getDynamicRow(schema)
 */
export function getDynamicRow(schema: object): DynamicRowState | undefined {
  return schemaRows.get(schema)
}
