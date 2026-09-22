import type { NamePath, Values } from "../types"
import type {
  ValidationCancelled,
  ValidationError,
  ValidationFailure,
  ValidationSuccess,
} from "./types"

/**
 * 创建没有错误的校验成功结果；直接保留传入的值引用。
 *
 * @typeParam TValues - 本次校验使用的表单值类型。
 * @param values - 本次校验的表单值；需要快照时由调用方提前创建。
 * @example
 * ```ts
 * createValidationSuccess({ email: "user@example.com" })
 * ```
 */
export function createValidationSuccess<TValues extends Values>(
  values: TValues
): ValidationSuccess<TValues> {
  return { valid: true, values, errors: [] }
}

/**
 * 创建普通校验失败结果，并复制错误数组；直接保留传入的值和错误对象引用。
 *
 * @typeParam TValues - 本次校验使用的表单值类型。
 * @typeParam TName - 错误所属的字段路径，默认为表单的所有合法路径。
 * @param values - 本次校验的表单值；需要快照时由调用方提前创建。
 * @param errors - 至少包含一个字段级或表单级错误的数组。
 * @throws 当错误数组为空时抛出 `TypeError`。
 * @example
 * ```ts
 * createValidationFailure({ email: "invalid" }, [
 *   { scope: "field", name: "email", issues: [{ message: "邮箱格式错误" }] },
 * ])
 * ```
 */
export function createValidationFailure<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(
  values: TValues,
  errors: readonly ValidationError<TName>[]
): ValidationFailure<TValues, TName> {
  // 首项检查同时建立运行时和类型层的非空约束。
  const [first, ...rest] = errors

  if (first === undefined) {
    throw new TypeError("校验失败结果必须包含至少一个错误")
  }

  return { valid: false, values, errors: [first, ...rest] }
}

/**
 * 创建不携带过期错误的取消结果；直接保留传入的值引用。
 *
 * @typeParam TValues - 被取消运行使用的表单值类型。
 * @param values - 被取消运行的表单值；需要快照时由调用方提前创建。
 * @example
 * ```ts
 * createValidationCancelled({ email: "user@example.com" })
 * ```
 */
export function createValidationCancelled<TValues extends Values>(
  values: TValues
): ValidationCancelled<TValues> {
  return { valid: false, cancelled: true, values, errors: [] }
}
