/**
 * Validator 执行规则所需的基础类型。
 *
 * 此模块不依赖 adapter 或 Controller，供校验规则、adapter 协议与 Validator 共同使用。
 *
 * @module types/validation
 */

import type { NamePath, Values } from "./form"

/**
 * 运行校验规则时提供的只读上下文。
 */
export interface ValidationRuleContext<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 当前正在校验的字段路径。 */
  readonly name: TName
  /** 当前表单值的只读快照。 */
  readonly values: Readonly<TValues>
  /** 用于中止异步规则执行的信号。 */
  readonly signal: AbortSignal
}

/**
 * 单条校验失败信息。
 */
export interface ValidationRuleIssue {
  /** 面向用户的错误提示。 */
  readonly message: string
  /** 可选的稳定错误编码。 */
  readonly code?: string
  /** 导致该问题的原始异常或上下文。 */
  readonly cause?: unknown
}

/**
 * 校验规则的执行结果。
 */
export type ValidationRuleResult =
  | { readonly valid: true }
    | {
      /** 失败结果标记。 */
      readonly valid: false
      /** 至少包含一个问题的错误列表。 */
      readonly issues: readonly [ValidationRuleIssue, ...ValidationRuleIssue[]]
      /** 是否阻止后续规则继续执行。 */
      readonly bail?: boolean
    }

/**
 * 可被 Validator 执行的原生校验规则。
 */
export interface ValidationRule<
  TValue = unknown,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  /** 执行单条规则并返回同步或异步校验结果。 */
  validate(
    value: TValue | undefined,
    context: ValidationRuleContext<TValues, TName>
  ): ValidationRuleResult | Promise<ValidationRuleResult>
}
