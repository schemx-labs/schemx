/**
 * 校验规则类型体系。
 *
 * @module types/rule
 */

import type { FieldValue, NamePath, Values } from "./form"
import type { StandardSchemaV1 } from "./standardSchema"
import type { ValidationRule } from "./validation"
import type { ValidationAdapterV1 } from "./validationAdapter"

/**
 * 必填校验的可选配置。
 *
 * @typeParam TValue - 字段值类型。
 *
 * @example
 * ```ts
 * const required: RequiredOptions<string> = {
 *   message: "请输入姓名",
 *   isEmpty: (value) => !value?.trim(),
 * }
 * ```
 */
export interface RequiredOptions<TValue = unknown> {
  message?: string
  isEmpty?: (value: TValue | null | undefined) => boolean
}

/**
 * 字段的必填声明。
 *
 * `true` 使用默认空值判断；对象形式可自定义提示文案或空值判断。
 *
 * @typeParam TValue - 字段值类型。
 *
 * @example
 * ```ts
 * const schema = {
 *   name: "email",
 *   label: "邮箱",
 *   componentType: "input",
 *   required: { message: "请填写邮箱" },
 * }
 * ```
 */
export type RequiredRule<TValue = unknown> = boolean | RequiredOptions<TValue>

/**
 * 去除 `undefined` 后的字段值类型，供校验规则声明其可校验的值。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段路径。
 */
export type DefinedFieldValue<
  TValues extends Values,
  TName extends NamePath<TValues>,
> = Exclude<FieldValue<TValues, TName>, undefined>

/**
 * 命名校验规则的声明合并扩展点。
 *
 * 在模块声明中添加属性后，`rules` 只接受与字段值类型匹配的规则名称。
 *
 * @example
 * ```ts
 * declare module "@schemx/core" {
 *   interface ValidationRuleDefinition {
 *     email: string
 *   }
 * }
 * ```
 */
export interface ValidationRuleDefinition {}

type DeclaredRuleName = Extract<keyof ValidationRuleDefinition, string>

/**
 * 与字段值类型兼容的已声明命名规则。
 *
 * 未声明任何规则时回退为 `string`，以支持运行时注册。
 *
 * @typeParam TValue - 字段值类型。
 */
export type ValidationRuleName<TValue> = [DeclaredRuleName] extends [never]
  ? string
  : {
      [K in DeclaredRuleName]: TValue extends ValidationRuleDefinition[K] ? K : never
    }[DeclaredRuleName]

/**
 * 单条字段校验规则，可以是命名规则、原生规则、Standard Schema 或 adapter 专属对象。
 *
 * adapter 在 Form 创建时注册，因此无法在 Schema 类型中静态推导其专属输入；对象规则
 * 会在运行时路由到唯一匹配的 adapter，无法识别时会作为字段配置错误记录。
 *
 * @typeParam TValues - 表单值类型。
 * @typeParam TName - 字段路径。
 * @typeParam TValue - 字段值类型。
 *
 * @example
 * ```ts
 * const rules: FieldRule<LoginForm, "email"> = "email"
 * ```
 */
export type FieldRule<
  TValues extends Values,
  TName extends NamePath<TValues>,
  TValue = DefinedFieldValue<TValues, TName>,
> =
  | ValidationRuleName<TValue>
  | ValidationAdapterV1.Rule
  | ValidationRule<TValue, TValues, TName>
  | StandardSchemaV1<TValue, unknown>
  | object

/**
 * 字段的校验规则集合，允许单条规则或只读规则数组。
 *
 * @example
 * ```ts
 * const rules: FieldRules<LoginForm, "email"> = ["email", emailSchema]
 * ```
 */
export type FieldRules<TValues extends Values, TName extends NamePath<TValues>> =
  FieldRule<TValues, TName> | readonly FieldRule<TValues, TName>[]
