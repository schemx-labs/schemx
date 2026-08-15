import Schema from "async-validator"

import type {
  NamePath,
  ValidationAdapter,
  ValidationRule,
  ValidationRuleContext,
  ValidationRuleIssue,
  ValidationRuleResult,
  Values,
} from "@schemx/core"
import type { Rule, RuleItem } from "async-validator"

/**
 * async-validator 字段规则输入。
 *
 * 类型上支持单个 `RuleItem` 或按声明顺序组织的规则数组。
 */
export type AsyncValidatorDescriptor = RuleItem | readonly RuleItem[]

// 用于识别 async-validator 规则输入的配置字段名。
const asyncValidatorDescriptorKeys = [
  "type",
  "required",
  "pattern",
  "min",
  "max",
  "len",
  "enum",
  "whitespace",
  "fields",
  "options",
  "defaultField",
  "transform",
  "message",
  "asyncValidator",
  "validator",
] as const

/**
 * async-validator 校验规则适配器。
 *
 * 适配器通过规则对象中的已知配置字段识别输入，并将其转换为 Core 原生校验规则。
 * 注册 adapter 后，async-validator 规则可直接放入字段 `rules`。
 */
export interface AsyncValidatorValidationAdapter extends ValidationAdapter<AsyncValidatorDescriptor> {
  /**
   * 供 Form 配置识别此 adapter 的固定标识。
   */
  readonly id: "async-validator"
  /**
   * 判断值是否包含可由 async-validator 适配器处理的规则配置。
   *
   * @param value - 待识别的规则输入。
   * @returns 值是否包含 async-validator 支持的规则字段。
   */
  isRule(value: unknown): value is AsyncValidatorDescriptor
  /**
   * 将 async-validator 规则输入转换为 Core 原生校验规则。
   *
   * @typeParam TValue - 当前字段值类型。
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 当前字段路径。
   * @param rule - 已通过 `isRule()` 识别的 async-validator 规则输入。
   * @param context - 当前字段的名称和标签等解析上下文。
   * @returns 由 Validator 执行的原生校验规则列表。
   */
  resolve: ValidationAdapter<AsyncValidatorDescriptor>["resolve"]
}

/**
 * 创建 async-validator 校验规则适配器。
 *
 * @returns 可注册到 Form 的 id 为 `"async-validator"` 的 adapter。
 *
 * @example
 * ```ts
 * const asyncValidator = createAsyncValidatorAdapter()
 * const emailRule = { type: "email", message: "邮箱格式错误" }
 * ```
 *
 */
export function createAsyncValidatorAdapter(): AsyncValidatorValidationAdapter {
  // 将外部规则输入解析为 Core 原生校验规则的适配函数。
  const resolve: AsyncValidatorValidationAdapter["resolve"] = <
    TValue,
    TValues extends Values,
    TName extends NamePath<TValues>,
  >(
    input: unknown
  ) => {
    if (!isAsyncValidatorDescriptor(input)) {
      throw new TypeError("async-validator 规则输入必须为包含有效规则字段的对象")
    }

    return [createAsyncValidatorValidationRule<TValue, TValues, TName>(input)]
  }

  return { id: "async-validator", isRule: isAsyncValidatorDescriptor, resolve }
}

/**
 * 将 async-validator 规则输入包装为 Core 原生校验规则。
 *
 * 规则执行时把当前字段值注入完整表单值快照作为校验来源，使自定义 validator
 * 可以读取关联字段；校验被中止时按无问题处理，避免返回陈旧错误。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径。
 * @param descriptor - 已通过规则识别的 async-validator 规则输入。
 * @returns 供 Validator 执行的原生校验规则。
 */
function createAsyncValidatorValidationRule<
  TValue,
  TValues extends Values,
  TName extends NamePath<TValues>,
>(descriptor: AsyncValidatorDescriptor): ValidationRule<TValue, TValues, TName> {
  return {
    async validate(value, context) {
      return validateDescriptor(descriptor, value, context)
    },
  }
}

/**
 * 用 async-validator 执行当前字段规则，并映射为 Schemx 校验结果。
 *
 * 将当前字段值注入完整表单值快照作为校验来源，使规则中的自定义 validator
 * 可读取关联字段；校验被中止时按无问题处理，避免返回陈旧错误。
 *
 * @param descriptor - 当前字段的 async-validator 规则输入。
 * @param value - 当前字段待校验的值。
 * @param context - 当前校验运行的上下文及取消信号。
 * @returns Core 统一格式的校验结果。
 */
async function validateDescriptor(
  descriptor: AsyncValidatorDescriptor,
  value: unknown,
  context: ValidationRuleContext
): Promise<ValidationRuleResult> {
  // 校验已被新一轮校验或销毁中止：返回成功以避免写入陈旧错误。
  if (context.signal.aborted) return { valid: true }

  // async-validator 以字符串 key 注册规则输入，需将字段路径转为字符串。
  const name = String(context.name)

  // 保留其他字段，供 async-validator 的自定义 validator 读取完整表单上下文。
  const source = { ...context.values, [name]: value }

  // 只为当前字段创建 async-validator 规则配置。
  const schema = new Schema({ [name]: descriptor as Rule })

  try {
    // 库默认会向控制台输出预期的校验失败，Schemx 改由 ValidationRuleResult 统一呈现。
    await schema.validate(source, { suppressWarning: true })
  } catch (error) {
    // 校验已被取消，async-validator 抛出的失败属于过时结果，按无问题处理。
    if (context.signal.aborted) return { valid: true }

    return toValidationResult(error)
  }

  return { valid: true }
}

/**
 * 判断值是否为可识别的 async-validator 规则输入。
 *
 * 当前实现要求输入为非数组对象，并且至少包含一个 async-validator 规则字段。
 */
function isAsyncValidatorDescriptor(value: unknown): value is AsyncValidatorDescriptor {
  if (value === null || typeof value !== "object") {
    return false
  }

  // Standard Schema（包括 Zod）交给内置 adapter
  if ("~standard" in value) {
    return false
  }

  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => asyncValidatorDescriptorKeys.includes(key as any))
  )
}

/**
 * 将 async-validator 抛出的失败转换为 Schemx 校验结果。
 *
 * 按声明顺序映射每条错误，并保留原始错误对象作为 issue 的 `cause`；
 * 若错误中不含可识别的校验失败，视为非预期异常重新抛出。
 *
 * @param error - async-validator 抛出的异常对象。
 * @returns Core 统一格式的失败结果。
 */
function toValidationResult(error: unknown): ValidationRuleResult {
  // 提取 async-validator 提供的结构化错误列表。
  const errors = getValidationErrors(error)

  // 以 async-validator 报告的字段路径作为 issue 的 code，便于调用方定位失败来源。
  const issues = errors.map<ValidationRuleIssue>((item) => ({
    message: item.message ?? "校验失败",
    ...(item.field ? { code: item.field } : {}),
    cause: item,
  }))

  if (issues.length > 0) return { valid: false, issues: [issues[0], ...issues.slice(1)] }

  // error 不含可识别的 async-validator 校验失败，视为非预期异常重新抛出。
  throw error
}

/**
 * 从异常中提取 async-validator 的校验错误列表。
 *
 * async-validator 校验失败时抛出的异常带有 `errors` 数组；其他异常返回空列表，
 * 交由调用方决定是否重新抛出。
 *
 * @param error - 待检查的异常值。
 * @returns 经过基本结构过滤的 async-validator 错误列表。
 */
function getValidationErrors(error: unknown): readonly AsyncValidatorError[] {
  if (typeof error !== "object" || error === null || !("errors" in error)) return []

  // 读取异常中的 errors 字段，后续再进行数组和元素校验。
  const errors = (error as { errors?: unknown }).errors

  return Array.isArray(errors) ? errors.filter(isAsyncValidatorError) : []
}

/**
 * 判断值是否为 async-validator 的单条错误对象。
 *
 * 错误对象为非 null 对象；此处仅做宽松结构判定，具体字段在映射时再安全读取。
 *
 * @param value - 待检查的错误值。
 * @returns 值是否为非 null 对象。
 */
function isAsyncValidatorError(value: unknown): value is AsyncValidatorError {
  return typeof value === "object" && value !== null
}

/**
 * async-validator 抛出的单条校验错误结构。
 */
interface AsyncValidatorError {
  /**
   * 失败时由规则输入或库默认提供的展示消息。
   */
  readonly message?: string
  /**
   * 失败字段路径，用于定位校验错误所属的字段。
   */
  readonly field?: string
}
