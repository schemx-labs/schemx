import type { NamePath, StandardSchemaV1, Values } from "../types"
import type {
  ValidationAdapter,
  ValidationRule,
  ValidationRuleContext,
  ValidationRuleIssue,
  ValidationRuleResult,
} from "./types"

/**
 * Standard Schema V1 校验规则适配器契约。
 *
 * 适配器负责识别实现 Standard Schema V1 协议的 Schema 对象，并将其转换为
 * Core 可执行的原生校验规则。Standard Schema adapter 由 Core 内部固定注册。
 */
export interface StandardSchemaValidationAdapter extends ValidationAdapter<
  StandardSchemaV1<unknown, unknown>
> {
  /**
   * 供当前 Form 的 adapter 路由表识别此 adapter 的固定标识。
   */
  readonly id: symbol | string
  /**
   * 判断值是否为合法的 Standard Schema V1 规则。
   *
   * @param value - 待识别的规则值。
   * @returns 值是否实现了完整的 Standard Schema V1 协议。
   */
  isRule(value: unknown): value is StandardSchemaV1<unknown, unknown>
  /**
   * 将 Standard Schema V1 规则转换为 Core 原生校验规则。
   *
   * @typeParam TValue - 当前字段值类型。
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 当前字段路径。
   * @param rule - 已通过 `isRule()` 识别的 Standard Schema 规则。
   * @param context - 当前字段的名称和标签等解析上下文。
   * @returns 由 Validator 执行的原生校验规则列表。
   */
  resolve: ValidationAdapter<StandardSchemaV1<unknown, unknown>>["resolve"]
}

/**
 * 创建 Standard Schema V1 校验规则适配器。
 *
 * 每次创建的适配器都会获得独立的 symbol 标识；Core 内部通常只创建并注册一个
 * Standard Schema adapter，避免同一规则被多个内置 adapter 重复处理。
 *
 * @returns 可注册到 Form 校验路由表的 Standard Schema adapter。
 *
 * @example
 * ```ts
 * const adapter = createStandardSchemaAdapter()
 * const form = createForm({ validatorAdapters: [adapter] })
 * ```
 */
export function createStandardSchemaAdapter(): StandardSchemaValidationAdapter {
  // 将 Standard Schema 规则输入解析为 Core 原生校验规则的适配函数。
  const resolve: StandardSchemaValidationAdapter["resolve"] = <
    TValue,
    TValues extends Values,
    TName extends NamePath<TValues>,
    >(
      input: StandardSchemaV1<TValue, unknown>
    ) => {
    if (!isStandardSchema(input)) {
      throw new TypeError("Standard Schema 规则输入必须实现 Standard Schema V1 协议")
    }

    return [createStandardSchemaValidationRule<TValue, TValues, TName>(input)]
  }

  return {
    id: Symbol("built-in-standard-schema"),
    isRule: isStandardSchema,
    resolve,
  }
}

/**
 * 将 Standard Schema V1 包装为 Core 原生校验规则。
 *
 * 仅转换 Standard Schema 的错误信息，不会使用其输出值改写表单状态。
 *
 * @typeParam TValue - Standard Schema 接收的字段值类型。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param schema - 实现 Standard Schema V1 协议的 Schema 对象。
 * @returns 可注册到 Validator 的校验规则。
 *
 * @example
 * ```ts
 * const rule = createStandardSchemaValidationRule(emailSchema)
 * ```
 */
function createStandardSchemaValidationRule<
  TValue,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(schema: StandardSchemaV1<TValue, unknown>): ValidationRule<TValue, TValues, TName> {
  return {
    async validate(value, context) {
      // Standard Schema 仅提供错误信息；其转换后的 value 不回写表单。
      return validateStandardSchema(schema, value, context)
    },
  }
}

/**
 * 执行 Standard Schema 校验，并处理已取消的校验结果。
 *
 * Standard Schema 的输出值不参与表单写入，仅消费问题列表。
 *
 * @typeParam TValue - Standard Schema 接收的字段值类型。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param schema - 要执行的 Standard Schema V1 对象。
 * @param value - 当前字段待校验的值。
 * @param context - 当前校验运行的上下文及取消信号。
 * @returns Core 统一格式的校验结果。
 */
async function validateStandardSchema<
  TValue,
  TValues extends Values,
  TName extends NamePath<TValues>,
>(
  schema: StandardSchemaV1<TValue, unknown>,
  value: TValue,
  context: ValidationRuleContext<TValues, TName>
): Promise<ValidationRuleResult> {
  if (context.signal.aborted) return { valid: true }

  const result = await schema["~standard"].validate(value)

  if (context.signal.aborted) return { valid: true }

  return toValidationResult(result)
}

/**
 * 将 Standard Schema 结果转换为 Schemx 的统一校验结果。
 *
 * @param result - Standard Schema 返回的成功或失败结果。
 * @returns 仅包含校验状态和问题信息的 Core 结果，不回写 Schema 输出值。
 */
function toValidationResult(
  result: StandardSchemaV1.Result<unknown>
): ValidationRuleResult {
  const issues =
    result.issues?.map<ValidationRuleIssue>((issue) => ({ message: issue.message })) ?? []

  return issues.length > 0
    ? { valid: false, issues: [issues[0], ...issues.slice(1)] }
    : { valid: true }
}

/**
 * 判断值是否为 Standard Schema V1 协议对象。
 *
 * @param value - 待识别的规则值。
 * @returns 值是否包含版本、供应商和校验函数均有效的 `~standard` 协议对象。
 */
function isStandardSchema(value: unknown): value is StandardSchemaV1<unknown, unknown> {
  if (value === null || typeof value !== "object") {
    return false
  }

  // Standard Schema 的规范属性
  if (!Object.hasOwn(value, "~standard")) {
    return false
  }

  const standard = (value as { "~standard"?: unknown })["~standard"]

  return (
    typeof standard === "object" &&
    standard !== null &&
    (standard as { version?: unknown }).version === 1 &&
    typeof (standard as { vendor?: unknown }).vendor === "string" &&
    typeof (standard as { validate?: unknown }).validate === "function"
  )
}
