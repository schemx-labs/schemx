/**
 * Validator adapter 的注册表构建和规则路由工具。
 *
 * @module core/validator/adapters
 */

import type {
  ValidationAdapter,
  ValidationAdapterID,
  ValidationAdapterOption,
} from "./types"

/**
 * 将当前 Form 的 adapter 注册项整理为路由表。
 *
 * 内置 adapter 与用户 adapter 均由调用方传入；本函数只负责统一归一化注册项、
 * 校验 adapter ID，并处理重复 ID 的覆盖规则。
 *
 * @param validatorAdapters - 要注册的 adapter 或带覆盖选项的注册项。
 * @returns 按 adapter ID 建立的只读路由表。
 * @throws 当 adapter ID 无效或重复注册且未显式允许覆盖时抛出错误。
 *
 * @example
 * ```ts
 * const adapters = createValidationAdapterMap([myAdapter])
 * ```
 */
export function createValidationAdapterMap(
  validatorAdapters: readonly ValidationAdapterOption[]
): ReadonlyMap<ValidationAdapterID, ValidationAdapter> {
  // 当前 Form 的 adapter 路由表；内置 adapter 的注册顺序由调用方决定。
  const map = new Map<ValidationAdapterID, ValidationAdapter>()

  for (const option of validatorAdapters) {
    // 将简写注册项统一为 adapter 与覆盖标志。
    const { adapter, override } = normalizeValidationAdapterOption(option)

    // 当前注册项的稳定路由标识。
    const id = getValidationAdapterId(adapter)

    if (map.has(id) && !override) {
      throw new Error(`重复的校验 adapter id "${formatValidationAdapterId(id)}"`)
    }

    map.set(id, adapter)
  }

  return map
}

/**
 * 归一化简写 adapter 与带覆盖选项的完整写法。
 *
 * @param option - 单个 adapter 或 `{ adapter, override }` 注册项。
 * @returns 拆分后的 adapter 和覆盖标志。
 */
function normalizeValidationAdapterOption(option: ValidationAdapterOption): {
  readonly adapter: ValidationAdapter
  readonly override: boolean
} {
  if ("adapter" in option) {
    return { adapter: option.adapter, override: option.override === true }
  }

  return { adapter: option, override: false }
}

/**
 * 按注册顺序查找首个能够处理规则的 adapter。
 *
 * @param adapters - 当前 Form 的 adapter 路由表。
 * @param rule - 待识别的字段规则。
 * @returns 按注册顺序找到的首个 adapter；没有命中时返回 `undefined`。
 *
 * @example
 * ```ts
 * const adapter = findValidationAdapter(adapters, rule)
 * ```
 */
export function findValidationAdapter(
  adapters: ReadonlyMap<ValidationAdapterID, ValidationAdapter>,
  rule: unknown
): ValidationAdapter | undefined {
  // Adapter 的注册顺序决定多个 adapter 同时命中时的解析优先级。
  for (const adapter of adapters.values()) {
    if (adapter.isRule(rule)) return adapter
  }

  return undefined
}

/**
 * 验证并返回 adapter 的可用标识。
 *
 * @param adapter - 待注册的 adapter。
 * @returns 非空字符串或 symbol 形式的 adapter ID。
 * @throws 当 ID 缺失或不是非空字符串/symbol 时抛出错误。
 */
function getValidationAdapterId(adapter: ValidationAdapter): ValidationAdapterID {
  // 待验证的 adapter 标识。
  const id = (adapter as { id?: ValidationAdapterID } | null)?.id

  if (typeof id === "symbol") return id
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("校验 adapter id 必须为非空字符串或 symbol")
  }

  return id
}

/**
 * 将 adapter ID 格式化为诊断信息。
 *
 * @param id - 要展示的 adapter ID。
 * @returns 适合放入错误消息的字符串。
 */
function formatValidationAdapterId(id: ValidationAdapterID): string {
  return typeof id === "symbol" ? String(id) : id
}
