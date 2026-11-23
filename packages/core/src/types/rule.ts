/**
 * 校验规则类型体系。
 *
 * 定义表单字段的校验规则类型，支持 Standard Schema、内置快捷方式和用户自定义扩展。
 * 用户可通过声明合并扩展 {@link SchemxRuleDefinition} 来注册自定义规则类型。
 *
 * @module types/rule
 */

/* eslint-disable @typescript-eslint/no-empty-object-type */

import type { StandardSchemaV1 } from "./standardSchema"

/**
 * 内置校验规则快捷方式。
 *
 * `"required"` 会被 FormItem 自动转换为 `createRequiredRule` 生成的 StandardSchemaV1 实例。
 */
export type SchemxRuleBuiltinKey = "required" | "selectRequired" | "uploadRequired"

/**
 * 自定义规则扩展接口。
 *
 * 用户通过声明合并（declaration merging）扩展此接口，
 * 将自定义规则名称映射到其对应的 StandardSchemaV1 实例类型。
 * 注册后，规则名称字符串可直接用于 `rules` 字段，运行时通过名称查找对应的 schema 执行校验。
 *
 * @example
 * ```ts
 * // 在项目中创建 schemx.d.ts
 * declare module '@schemx/core' {
 *   interface SchemxRuleDefinition {
 *     'phone': StandardSchemaV1<string>
 *     'email': StandardSchemaV1<string>
 *   }
 * }
 * ```
 *
 * @remarks
 * 扩展后，`SchemxRuleDefinitionKey` 会自动推导出所有已注册的规则名称字符串，
 * `SchemxRules` 类型也会随之包含这些名称。
 */
export interface SchemxRuleDefinition {}

/**
 * 自定义规则名称类型。
 *
 * 由 {@link SchemxRuleDefinition} 的键自动推导，
 * 代表所有已注册的自定义规则名称字符串。
 * 当 SchemxRuleDefinition 为空时自动降级为 never，不影响 SchemxRules 联合类型。
 */
export type SchemxRuleDefinitionKey = [keyof SchemxRuleDefinition] extends [never]
  ? string
  : keyof SchemxRuleDefinition

/**
 * 校验规则类型。
 *
 * 支持三种形式：
 * - `StandardSchemaV1` — 任何实现了 Standard Schema 接口的验证库实例
 * - `SchemxRuleBuiltinKey` — 内置快捷方式（如 `"required"`）
 * - `SchemxRuleDefinitionKey` — 用户通过声明合并注册的自定义规则名称
 *
 * 当 SchemxRuleDefinition 未注册任何规则时，自动降级为 `StandardSchemaV1 | SchemxRuleBuiltinKey`。
 */
export type SchemxRules = [keyof SchemxRuleDefinition] extends [never]
  ? StandardSchemaV1 | SchemxRuleBuiltinKey
  : StandardSchemaV1 | SchemxRuleBuiltinKey | SchemxRuleDefinitionKey

/**
 * Rule registry 内部使用的规则名称约束。
 *
 * 未声明自定义规则时会退化为任意字符串，声明后收窄为内置规则与声明规则的并集。
 */
export type SchemxRuleKey = SchemxRuleBuiltinKey | SchemxRuleDefinitionKey
