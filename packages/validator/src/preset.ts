import { createAsyncValidatorAdapter } from "./async-validator"

import type { AsyncValidatorValidationAdapter } from "./async-validator"

/**
 * 可交给 Schemx Form 或全局配置的校验 adapter 预设。
 */
export interface ValidationAdapterPreset {
  /**
   * 预设中按注册顺序提供的校验器适配器。
   */
  readonly validatorAdapters: readonly [AsyncValidatorValidationAdapter]
}

/**
 * 创建包含 async-validator 的校验 adapter 预设。
 *
 * @returns 新建的 adapter 实例。
 *
 * @example
 * ```ts
 * import { createValidationAdapterPreset } from "@schemx/validator/preset"
 *
 * const validation = createValidationAdapterPreset()
 * // Core 完成 adapter 协议接入后，可传入 createForm({ ...validation })。
 * ```
 */
export function createValidationAdapterPreset(): ValidationAdapterPreset {
  return {
    validatorAdapters: [createAsyncValidatorAdapter()],
  }
}
