/**
 * Schemx 第三方校验 adapter 的公共类型入口。
 *
 * 运行时实现应从 `/async-validator` 或 `/preset` 导入，
 * 以避免无意加载未使用的 optional peer dependency。
 */
export type { AsyncValidatorValidationAdapter } from "./async-validator"

/**
 * 导出预设适配器集合的类型。
 */
export type { ValidationAdapterPreset } from "./preset"
