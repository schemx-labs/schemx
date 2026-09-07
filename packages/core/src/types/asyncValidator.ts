/**
 * Core 内置 async-validator 规则类型。
 *
 * @module types/asyncValidator
 */

import type { RuleItem } from "async-validator"

/**
 * 单条 async-validator 规则。
 */
export type AsyncValidatorRule = RuleItem

/**
 * 单条或按顺序排列的 async-validator descriptor。
 */
export type AsyncValidatorDescriptor = AsyncValidatorRule | readonly AsyncValidatorRule[]
