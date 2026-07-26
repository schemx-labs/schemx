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
 * async-validator 单字段 descriptor。
 *
 * 可以传入单条 descriptor，也可以传入按声明顺序执行的 descriptor 数组。
 */
export type AsyncValidatorDescriptor = RuleItem | readonly RuleItem[]

// async-validator descriptor 中允许触发校验的字段名。
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
 * async-validator descriptor 是自描述规则：注册 adapter 后可直接放入字段 `rules`。
 */
export interface AsyncValidatorValidationAdapter extends ValidationAdapter<AsyncValidatorDescriptor> {
  /**
   * 供 Form 配置识别此 adapter 的固定标识。
   */
  readonly id: "async-validator"
  /**
   * 判断值是否为合法的 async-validator 单字段 descriptor。
   *
   * @param value - 待识别的规则值。
   * @returns 值是否为 descriptor 对象或仅含 descriptor 对象的数组。
   */
  isRule(value: unknown): value is AsyncValidatorDescriptor
  /**
   * 把 async-validator descriptor 解析为原生校验规则。
   *
   * 直接复用 Core `ValidationAdapter<AsyncValidatorDescriptor>` 的 `resolve` 签名，
   * 与 Core 契约完全一致。
   *
   * @typeParam TValues - 表单值类型。
   * @typeParam TName - 当前字段路径。
   * @param rule - 已通过 `isRule()` 识别的 descriptor。
   * @param context - 当前字段的校验配置。
   * @returns 单条原生校验规则，由 Validator 执行 descriptor 并映射错误。
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
  // 将外部 descriptor 解析为 Core 原生校验规则的适配函数。
  const resolve: AsyncValidatorValidationAdapter["resolve"] = <
    TValue,
    TValues extends Values,
    TName extends NamePath<TValues>,
  >(
    input: unknown
  ) => {
    if (!isAsyncValidatorDescriptor(input)) {
      throw new TypeError("async-validator descriptor 必须为对象或对象数组")
    }

    return [createAsyncValidatorValidationRule<TValue, TValues, TName>(input)]
  }

  return { id: "async-validator", isRule: isAsyncValidatorDescriptor, resolve }
}

/**
 * 将 async-validator descriptor 包装为原生校验规则。
 *
 * 规则执行时把当前字段值注入完整表单值快照作为校验来源，使 descriptor 的自定义
 * validator 可读取关联字段；校验被中止时按无问题处理，避免返回陈旧错误。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径。
 * @param descriptor - 已校验的单字段 async-validator descriptor。
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
 * 用 async-validator 执行单字段 descriptor 校验，并映射为 Schemx 校验结果。
 *
 * 将当前字段值注入完整表单值快照作为校验来源，使 descriptor 的自定义 validator
 * 可读取关联字段；校验被中止时按无问题处理，避免返回陈旧错误。
 */
async function validateDescriptor(
  descriptor: AsyncValidatorDescriptor,
  value: unknown,
  context: ValidationRuleContext
): Promise<ValidationRuleResult> {
  // 校验已被新一轮校验或销毁中止：返回成功以避免写入陈旧错误。
  if (context.signal.aborted) return { valid: true }

  // async-validator 以字符串 key 注册 descriptor，需将字段路径转为字符串。
  const name = String(context.name)

  // 保留其他字段，供 async-validator 的自定义 validator 读取完整表单上下文。
  const source = { ...context.values, [name]: value }

  // 只为当前字段创建 async-validator descriptor。
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
 * 校验值是否为合法的 async-validator descriptor。
 *
 * descriptor 可为单条对象或对象数组；数组中的每个元素也必须为对象。
 */
function isAsyncValidatorDescriptor(value: unknown): value is AsyncValidatorDescriptor {
  if (value === null || typeof value !== "object") {
    return false
  }

  // 将单条 descriptor 统一包装成待检查数组。
  const rules = Array.isArray(value) ? value : [value]

  return rules.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      !Array.isArray(item) &&
      Object.keys(item).some((key) => asyncValidatorDescriptorKeys.includes(key as any))
  )
}

/**
 * 将 async-validator 抛出的失败转换为 Schemx 校验结果。
 *
 * 按声明顺序映射每条错误，并保留原始错误对象作为 issue 的 `cause`；
 * 若错误中不含可识别的校验失败，视为非预期异常重新抛出。
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
 */
function getValidationErrors(error: unknown): readonly AsyncValidatorError[] {
  if (typeof error !== "object" || error === null || !("errors" in error)) return []

  // 读取异常中的 errors 字段，后续再进行数组和元素校验。
  const errors = (error as { errors?: unknown }).errors

  return Array.isArray(errors) ? errors.filter(isAsyncValidatorError) : []
}

/**
 * 判断值是否为 async-validator 单条错误对象。
 *
 * 错误对象为非 null 对象；此处仅做宽松结构判定，具体字段在映射时再安全读取。
 */
function isAsyncValidatorError(value: unknown): value is AsyncValidatorError {
  return typeof value === "object" && value !== null
}

/**
 * async-validator 抛出的单条校验错误结构。
 */
interface AsyncValidatorError {
  /**
   * 失败时由 descriptor 或库默认提供的展示消息。
   */
  readonly message?: string
  /**
   * 失败字段路径，用于在多字段 descriptor 中定位错误来源。
   */
  readonly field?: string
}
