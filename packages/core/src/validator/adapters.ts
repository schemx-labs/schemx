import { createStandardSchemaValidationRule } from "./rules"

import type {
  AdapterRule,
  ValidationAdapter,
  ValidationAdapterID,
  ValidationAdapterOption,
  ValidationRule,
} from "./types"
import type { NamePath, StandardSchemaV1, Values } from "../types"

// 处理所有实现 Standard Schema V1 协议的规则。
const standardSchemaAdapter: ValidationAdapter<StandardSchemaV1<unknown, unknown>> = {
  id: Symbol("built-in-standard-schema"),
  isRule: isStandardSchema,
  resolve<TValue, TValues extends Values, TName extends NamePath<TValues>>(
    rule: AdapterRule | StandardSchemaV1<unknown, unknown>
  ): readonly ValidationRule<TValue, TValues, TName>[] {
    return [
      createStandardSchemaValidationRule<TValue, TValues, TName>(
        rule as StandardSchemaV1<TValue, unknown>
      ),
    ]
  },
}

/**
 * 创建当前 Form 的 adapter 路由表。
 *
 * Standard Schema adapter 始终最先注册，并使用模块私有 symbol ID，不能被外部覆盖。
 *
 * @param validatorAdapters - 要注册的 adapter 或带覆盖选项的注册项。
 * @returns 按 adapter ID 建立的只读路由表。
 * @throws 当 adapter ID 无效或重复注册且未显式允许覆盖时抛出错误。
 */
export function createValidationAdapterMap(
  validatorAdapters: readonly ValidationAdapterOption[]
): ReadonlyMap<ValidationAdapterID, ValidationAdapter> {
  // 当前 Form 的 adapter 路由表，先放入不可覆盖的 Standard Schema adapter。
  const map = new Map<ValidationAdapterID, ValidationAdapter>([
    [standardSchemaAdapter.id, standardSchemaAdapter],
  ])

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
 * 查找唯一能够处理规则的 adapter；多个 adapter 命中时拒绝歧义配置。
 *
 * @param adapters - 当前 Form 的 adapter 路由表。
 * @param rule - 待识别的字段规则。
 * @returns 唯一命中的 adapter；没有命中时返回 `undefined`。
 * @throws 当多个 adapter 同时声明能够处理规则时抛出错误。
 */
export function findValidationAdapter(
  adapters: ReadonlyMap<ValidationAdapterID, ValidationAdapter>,
  rule: unknown
): ValidationAdapter | undefined {
  // 收集所有能够识别该规则的 adapter，以检测配置歧义。
  const matched = [...adapters.values()].filter((adapter) => adapter.isRule(rule))

  if (matched.length > 1) {
    throw new Error(
      `校验规则同时匹配多个 adapter: ${matched
        .map((adapter) => formatValidationAdapterId(adapter.id))
        .join(", ")}`
    )
  }

  return matched[0]
}

/**
 * 判断值是否为 Standard Schema V1 协议对象。
 *
 * @param value - 待识别的规则值。
 * @returns 值是否包含 Standard Schema V1 的 `~standard` 标记。
 */
function isStandardSchema(value: unknown): value is StandardSchemaV1<unknown, unknown> {
  return typeof value === "object" && value !== null && "~standard" in value
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
