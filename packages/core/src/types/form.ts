/**
 * 表单基础类型
 *
 * 定义字段值、路径、动态属性和表单级 Schema 配置。
 *
 * @module types/form
 */

import type { DeepNamePath, PathValue } from "./namePathType"
import type { SchemxConfigKey } from "../config"
import type { PresetRuleEntry } from "../registry"
import type { SchemxBaseField } from "./field"
import type { FieldRules } from "./rule"

/**
 * 字段值类型。
 *
 * core 不限制具体值形态，校验和渲染器负责解释该值。
 */
export type FieldValue<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
> = PathValue<TValues, TName>

/**
 * 表单值对象类型。
 *
 * 顶层以字符串 key 索引，嵌套结构由 `NamePath` 和路径工具进一步约束。
 */
export type Values = Record<string, any>

/**
 * 动态属性类型
 *
 * 支持静态值或函数形式，函数接收当前表单值并返回属性值（支持异步）。
 */
export type Dynamic<TValue, TValues extends Values = Values> =
  ((values: TValues) => TValue | Promise<TValue>) | TValue

/**
 * 字段路径类型
 *
 * 支持字符串路径（如 `'user.address.city'`）和类型安全的深层路径推断。
 *
 * @typeParam TValues - 表单值类型，用于路径类型推断
 */
export type NamePath<TValues = Values> = DeepNamePath<TValues>

/**
 * 验证规则触发时机
 *
 * 支持两种命名风格：`onBlur` / `blur`，内部会归一化处理。
 */
export type ValidationTrigger =
  "onBlur" | "onChange" | "onSubmit" | "blur" | "change" | "submit"

/**
 * 表单级字段校验规则映射。
 *
 * key 是字段路径；字段自身 `rules` 或动态规则存在时优先。
 */
export type SchemxFieldRulesMap<TValues extends Values = Values> = {
  [TName in NamePath<TValues>]?:
    FieldRules<TValues, TName> | PresetRuleEntry<FieldValue<TValues, TName>>
}

/**
 * 表单级默认配置。
 *
 * 这些配置会作为 schema 编译和字段呈现态的默认值，字段自身配置优先级更高。
 */
export type SchemxSchemaConfig = Pick<SchemxBaseField, SchemxConfigKey>

/**
 * Schema 通用配置上下文。
 */
export interface SchemxGlobalContext {
  /** 当前生效的全局 Schema 默认配置。 */
  schemaConfig: Partial<SchemxSchemaConfig>
}
