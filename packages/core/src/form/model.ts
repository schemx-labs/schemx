import { batchUpdates, createSignalEffect } from "../reactivity"
import { createStore, type Store } from "../store"
import {
  createValidator,
  type CreateValidatorOptions,
  type ValidationAdapterOption,
  type Validator,
} from "../validator"

import type { PresetRuleRegistry } from "../registry"
import type { Values } from "../types"

/**
 * 创建 FormModel 所需的状态、校验和错误处理配置。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface CreateFormModelOptions<TValues extends Values> {
  /**
   * 创建 Store 时使用的初始值。
   */
  initialValues: TValues
  /**
   * 当前 Form 使用的命名规则 Registry。
   */
  presetRuleRegistry: PresetRuleRegistry
  /**
   * 当前 Form 注册的 adapter 列表。
   */
  validatorAdapters: readonly ValidationAdapterOption[]
  /**
   * 无法解析规则时调用的错误回调。
   */
  onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]
  /**
   * 整表校验的字段并发数，默认 `8`。
   */
  validationConcurrency?: number
}

/**
 * Form 的状态与校验聚合模型。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface FormModel<TValues extends Values> {
  /**
   * 字段值、快照、初始值和交互状态的 Store。
   */
  readonly store: Store<TValues>
  /**
   * 管理字段规则编译、执行、错误状态和生命周期的校验域。
   */
  readonly validation: Validator<TValues>
  /**
   * 重置字段值并清空校验错误。
   */
  reset(): void
  /**
   * 注册一个响应式副作用，并返回其取消函数。
   */
  effect(fn: () => void): () => void
  /**
   * 在同一批次内执行多个状态更新。
   */
  batch(fn: () => void): void
  /**
   * 幂等销毁 Model 持有的响应式、校验和 Store 资源。
   */
  dispose(): void
}

/**
 * 创建 Form 的状态与校验聚合模型。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Model 初始化和校验配置。
 * @returns 可供 Instance、Controller 和 Runtime 协作的 FormModel。
 *
 * @example
 * ```ts
 * const model = createFormModel({
 *   initialValues: {},
 *   presetRuleRegistry: createPresetRuleRegistry(),
 *   validatorAdapters: [],
 * })
 *
 * model.reset()
 * model.dispose()
 * ```
 */
export function createFormModel<TValues extends Values>(
  options: CreateFormModelOptions<TValues>
): FormModel<TValues> {
  // Store 保存字段值与交互状态。
  const store = createStore<TValues>({ initialValues: options.initialValues })

  const validation = createValidator<TValues>({
    fieldStore: store,
    presetRuleRegistry: options.presetRuleRegistry,
    validatorAdapters: options.validatorAdapters,
    onRuleError: options.onRuleError,
    validationConcurrency: options.validationConcurrency,
  })

  // 防止销毁后重复注册或释放响应式副作用。
  let disposed = false

  // Model 生命周期内注册的响应式副作用取消函数。
  const effectDisposers = new Set<() => void>()

  /**
   * 重置字段值并清空全部校验错误。
   */
  const reset: FormModel<TValues>["reset"] = () => {
    store.reset()
    store.clearAllErrors()
  }

  /**
   * 注册并在 Model 生命周期内跟踪一个 effect。
   */
  const effect: FormModel<TValues>["effect"] = (fn) => {
    // 先执行一次副作用以建立响应式依赖，再由 Model 统一管理其生命周期。
    const disposeEffect = createSignalEffect(fn)

    if (disposed) {
      disposeEffect()

      return () => {}
    }

    // 返回取消函数时同步从 Model 的资源集合中移除该副作用。
    effectDisposers.add(disposeEffect)

    return () => {
      if (!effectDisposers.delete(disposeEffect)) {
        return
      }

      disposeEffect()
    }
  }

  /**
   * 将状态更新合并到一次响应式 batch 中。
   */
  const batch: FormModel<TValues>["batch"] = (fn) => {
    batchUpdates(fn)
  }

  /**
   * 仅执行一次并释放 Model 持有的全部资源。
   */
  const dispose: FormModel<TValues>["dispose"] = () => {
    if (disposed) {
      return
    }

    disposed = true
    for (const disposeEffect of [...effectDisposers].reverse()) {
      disposeEffect()
    }

    effectDisposers.clear()
    validation.destroy()
    store.destroy()
  }

  return {
    store,
    validation,
    reset,
    effect,
    batch,
    dispose,
  }
}
