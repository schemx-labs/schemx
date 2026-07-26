/**
 * Validator 执行规则所需的基础类型。
 *
 * 此模块不依赖 adapter 或 Controller，供校验规则、adapter 协议与 Validator 共同使用。
 *
 * @module types/validation
 */

import type { NamePath, Values } from "./form"

/** 运行校验规则时提供的只读上下文。 */
export interface ValidationRuleContext<
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  readonly name: TName
  readonly values: Readonly<TValues>
  readonly signal: AbortSignal
}

/** 单条校验失败信息。 */
export interface ValidationRuleIssue {
  readonly message: string
  readonly code?: string
  readonly cause?: unknown
}

/** 校验规则的执行结果。 */
export type ValidationRuleResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly issues: readonly [ValidationRuleIssue, ...ValidationRuleIssue[]]
      readonly bail?: boolean
    }

/** 可被 Validator 执行的原生校验规则。 */
export interface ValidationRule<
  TValue = unknown,
  TValues extends Values = Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> {
  validate(
    value: TValue | undefined,
    context: ValidationRuleContext<TValues, TName>
  ): ValidationRuleResult | Promise<ValidationRuleResult>
}
