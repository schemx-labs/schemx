import { batchUpdates, createSignalEffect } from "../reactivity"
import { createStore, type Store } from "../store"
import {
  createValidationController,
  createValidator,
  type CreateValidatorOptions,
  type FieldValidationConfig,
  type ValidationAdapterOption,
  type ValidationController,
  type Validator,
} from "../validator"

import type { ValidationRuleRegistry } from "../registry"
import type { FieldValue, NamePath, Values } from "../types"

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
  validationRuleRegistry: ValidationRuleRegistry
  /**
   * 当前 Form 注册的 adapter 列表。
   */
  validatorAdapters: readonly ValidationAdapterOption[]
  /**
   * 无法解析规则时调用的错误回调。
   */
  onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]
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
   * 执行字段与表单校验的 Validator。
   */
  readonly validator: Validator<TValues>
  /**
   * 维护字段校验配置同步的 Controller。
   */
  readonly validation: ValidationController<TValues>
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
 * Schema Runtime 访问 FormModel 的最小能力集合。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface RuntimeFormModelPort<TValues extends Values> {
  /**
   * 读取指定字段的当前值。
   */
  getFieldValue<TName extends NamePath<TValues>>(
    name: TName
  ): FieldValue<TValues, TName> | undefined
  /**
   * 更新指定字段的当前值。
   */
  setFieldValue<TName extends NamePath<TValues>>(
    name: TName,
    value: FieldValue<TValues, TName> | undefined
  ): void
  /**
   * 合并更新字段初始值。
   */
  setInitialValues(values: Partial<TValues>): void
  /**
   * 同步字段校验配置并返回是否发生变化。
   */
  syncValidationField<TName extends NamePath<TValues>>(
    config: FieldValidationConfig<TValues, TName>
  ): boolean
  /**
   * 移除指定字段的校验配置。
   */
  removeValidationField(name: NamePath<TValues>): void
}

/**
 * 从完整 FormModel 创建供 Runtime 使用的最小访问端口。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param model - 要暴露能力的 FormModel。
 * @returns 只包含 Runtime 所需操作的端口。
 */
export function createRuntimeFormModelPort<TValues extends Values>(
  model: FormModel<TValues>
): RuntimeFormModelPort<TValues> {
  // 绑定方法以隔离 Runtime 与 Store/ValidationController 的具体实现。
  // Runtime-safe binding for reading one field value.
  const getFieldValue = model.store.getFieldValue.bind(model.store)

  // Runtime-safe binding for updating one field value.
  const setFieldValue = model.store.setFieldValue.bind(model.store)

  // Runtime-safe binding for updating initial field values.
  const setInitialValues = model.store.setInitialValues.bind(model.store)

  // Runtime-safe binding for synchronizing a field validation configuration.
  const syncValidationField = model.validation.syncField.bind(model.validation)

  // Runtime-safe binding for removing a field validation configuration.
  const removeValidationField = model.validation.removeField.bind(model.validation)

  return {
    getFieldValue,
    setFieldValue,
    setInitialValues,
    syncValidationField,
    removeValidationField,
  }
}

/**
 * 创建 Form 的状态与校验聚合模型。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Model 初始化和校验配置。
 * @returns 可供 Facade、Controller 和 Runtime 协作的 FormModel。
 */
export function createFormModel<TValues extends Values>(
  options: CreateFormModelOptions<TValues>
): FormModel<TValues> {
  // Store 保存字段值与交互状态。
  const store = createStore<TValues>({ initialValues: options.initialValues })

  // Validator 执行原生规则并归档校验错误。
  const validator = createValidator<TValues>({ onRuleError: options.onRuleError })

  // ValidationController 将字段配置解析为 Validator 可执行规则。
  const validation = createValidationController({
    validator,
    registry: options.validationRuleRegistry,
    validatorAdapters: options.validatorAdapters,
  })

  // 防止销毁后重复注册或释放响应式副作用。
  let disposed = false

  // Model 生命周期内注册的响应式副作用取消函数。
  const effectDisposers = new Set<() => void>()

  /**
   * Resets field values and clears all validation errors.
   */
  const reset: FormModel<TValues>["reset"] = () => {
    store.reset()
    validator.clearErrors()
  }

  /**
   * Registers and tracks an effect for the Model lifetime.
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
   * Groups state updates into a single reactive batch.
   */
  const batch: FormModel<TValues>["batch"] = (fn) => {
    batchUpdates(fn)
  }

  /**
   * Releases every resource owned by the Model exactly once.
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
    validator.destroy()
    store.destroy()
  }

  return {
    store,
    validator,
    validation,
    reset,
    effect,
    batch,
    dispose,
  }
}
