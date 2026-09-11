/**
 * Core 内置 async-validator 规则适配器。
 *
 * 该适配器只由 Core Validator 内部使用；业务代码直接在 `rules` 中提供
 * async-validator descriptor，无需手动注册适配器。
 *
 * @module core/validator/asyncValidator.adapter
 */

import * as AsyncValidatorModule from "async-validator"

import type { AsyncValidatorDescriptor, NamePath, Values } from "../types"
import type {
  ValidationAdapter,
  ValidationRule,
  ValidationRuleContext,
  ValidationRuleIssue,
  ValidationRuleResult,
} from "./types"
import type { Rule, RuleItem } from "async-validator"

// 规则对象至少包含一个 async-validator 支持的配置字段。
const asyncValidatorDescriptorKeys: ReadonlySet<string> = new Set([
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
])

// async-validator publishes CommonJS with an `__esModule` default export; resolve the
// native Node ESM, nested CommonJS, and bundler interop shapes before construction.
const asyncValidatorDefault = AsyncValidatorModule.default as unknown

const AsyncValidatorSchema = (
  typeof asyncValidatorDefault === "function"
    ? asyncValidatorDefault
    : (asyncValidatorDefault as { readonly default?: unknown }).default
) as typeof AsyncValidatorModule.default

/**
 * 创建 Core 内部使用的 async-validator 适配器。
 *
 * @returns 可识别 async-validator descriptor 的内部适配器。
 */
export function createAsyncValidatorAdapter(): ValidationAdapter<AsyncValidatorDescriptor> {
  const resolve: ValidationAdapter<AsyncValidatorDescriptor>["resolve"] = <
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
 * 将 descriptor 包装为 Core 原生校验规则。
 *
 * @typeParam TValue - 当前字段值类型。
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 当前字段路径类型。
 * @param descriptor - 已通过 descriptor 识别的规则输入。
 * @returns Core 可执行的原生规则。
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
 * 执行 descriptor 并将 async-validator 错误转换为 Core 结果。
 *
 * @param descriptor - 当前字段的 async-validator descriptor。
 * @param value - 当前字段值。
 * @param context - 当前校验运行上下文。
 * @returns Core 统一格式的校验结果。
 */
async function validateDescriptor(
  descriptor: AsyncValidatorDescriptor,
  value: unknown,
  context: ValidationRuleContext
): Promise<ValidationRuleResult> {
  if (context.signal.aborted) return { valid: true }

  const name = String(context.name)

  const source = { ...context.values, [name]: value }

  const schema = new AsyncValidatorSchema({ [name]: descriptor as Rule })

  try {
    await schema.validate(source, { suppressWarning: true })
  } catch (error) {
    if (context.signal.aborted) return { valid: true }

    return toValidationResult(error)
  }

  return { valid: true }
}

/**
 * 判断值是否为合法的 async-validator descriptor。
 *
 * @param value - 待识别的未知值。
 * @returns 值是否可由内置适配器处理。
 */
function isAsyncValidatorDescriptor(value: unknown): value is AsyncValidatorDescriptor {
  if (value === null || typeof value !== "object") return false

  if (Array.isArray(value)) return value.every(isAsyncValidatorRuleItem)

  return isAsyncValidatorRuleItem(value)
}

/**
 * 判断值是否为包含 async-validator 配置字段的规则对象。
 *
 * @param value - 待识别的未知值。
 * @returns 值是否为单条规则对象。
 */
function isAsyncValidatorRuleItem(value: unknown): value is RuleItem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false

  // Standard Schema 由 Core 的专用适配器处理，避免两个协议同时命中。
  if ("~standard" in value) return false

  return Object.keys(value).some((key) => asyncValidatorDescriptorKeys.has(key))
}

/**
 * 将 async-validator 的结构化错误转换为 Core issue 列表。
 *
 * @param error - async-validator 抛出的未知异常。
 * @returns Core 统一格式的校验结果；非结构化异常会重新抛出。
 */
function toValidationResult(error: unknown): ValidationRuleResult {
  const errors = getValidationErrors(error)

  const issues = errors.map<ValidationRuleIssue>((item) => ({
    message: item.message ?? "校验失败",
    ...(item.field ? { code: item.field } : {}),
    cause: item,
  }))

  if (issues.length > 0) {
    return { valid: false, issues: [issues[0], ...issues.slice(1)] }
  }

  throw error
}

/**
 * 从 async-validator 异常中读取结构化错误。
 *
 * @param error - 待读取的未知异常。
 * @returns 经过基本结构过滤的错误列表。
 */
function getValidationErrors(error: unknown): readonly AsyncValidatorError[] {
  if (typeof error !== "object" || error === null || !("errors" in error)) return []

  const errors = (error as { errors?: unknown }).errors

  return Array.isArray(errors) ? errors.filter(isAsyncValidatorError) : []
}

/**
 * 判断值是否为可映射的 async-validator 错误对象。
 *
 * @param value - 待检查的未知值。
 * @returns 值是否为非空对象。
 */
function isAsyncValidatorError(value: unknown): value is AsyncValidatorError {
  return typeof value === "object" && value !== null
}

/**
 * async-validator 单条错误的最小读取结构。
 */
interface AsyncValidatorError {
  /** 展示给用户的失败消息。 */
  readonly message?: string
  /** async-validator 报告的字段路径。 */
  readonly field?: string
}
