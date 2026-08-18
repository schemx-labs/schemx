import { createFieldArrayController } from "../fieldArray"
import { batchUpdates, createSignalEffect } from "../reactivity"
import { createStore, type Store } from "../store"
import { createFieldKey } from "../utils"
import {
  createValidation,
  type CreateValidationOptions,
  type Validation,
  type ValidationAdapterOption,
  type ValidationFieldConfig,
} from "../validator"
import { getValidationFieldArrayInvalidator } from "../validator/validation"

import type { FieldArrayInstance, FieldArrayPath } from "../fieldArray"
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
  onRuleError?: CreateValidationOptions<TValues>["onRuleError"]
  /** 整表校验的字段并发数，默认 `8`。 */
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
  readonly validation: Validation<TValues>
  /**
   * 获取并缓存指定数组字段的结构控制器。
   */
  getOrCreateFieldArray<TPath extends FieldArrayPath<TValues>>(
    name: TPath
  ): FieldArrayInstance<TValues, TPath>
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
  /** 注册 Schema 字段路径，建立批量值写入的原子边界。 */
  registerFieldPath<TName extends NamePath<TValues>>(name: TName): void
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
    config: ValidationFieldConfig<TValues, TName>
  ): boolean
  /**
   * 移除指定字段的校验配置。
   */
  removeValidationField(name: NamePath<TValues>): void
  /**
   * 停止 Schema 规则注册，但保留运行时规则覆盖。
   */
  removeSchemaValidationField(name: NamePath<TValues>): void
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
  const registerFieldPath = model.store.registerFieldPath.bind(model.store)

  // 为 Runtime 安全绑定单字段值读取方法。
  const getFieldValue = model.store.getFieldValue.bind(model.store)

  // 为 Runtime 安全绑定单字段值更新方法。
  const setFieldValue = model.store.setFieldValue.bind(model.store)

  // 为 Runtime 安全绑定初始字段值更新方法。
  const setInitialValues = model.store.setInitialValues.bind(model.store)

  // 为 Runtime 安全绑定字段校验配置同步方法。
  const syncValidationField = model.validation.syncSchemaField.bind(model.validation)

  // 为 Runtime 安全绑定字段校验配置移除方法。
  const removeValidationField = model.validation.removeSchemaField.bind(model.validation)

  // 为 Runtime 安全绑定临时移除 Schema 规则的方法。
  const removeSchemaValidationField = model.validation.removeSchemaField.bind(
    model.validation
  )

  return {
    registerFieldPath,
    getFieldValue,
    setFieldValue,
    setInitialValues,
    syncValidationField,
    removeValidationField,
    removeSchemaValidationField,
  }
}

/**
 * 创建 Form 的状态与校验聚合模型。
 *
 * @typeParam TValues - 表单值对象类型。
 * @param options - Model 初始化和校验配置。
 * @returns 可供 Instance、Controller 和 Runtime 协作的 FormModel。
 */
export function createFormModel<TValues extends Values>(
  options: CreateFormModelOptions<TValues>
): FormModel<TValues> {
  // Store 保存字段值与交互状态。
  const store = createStore<TValues>({ initialValues: options.initialValues })

  const validation = createValidation<TValues>({
    validationRuleRegistry: options.validationRuleRegistry,
    validatorAdapters: options.validatorAdapters,
    onRuleError: options.onRuleError,
    validationConcurrency: options.validationConcurrency,
  })

  const invalidateFieldArray = getValidationFieldArrayInvalidator(validation)

  // 同一个 Form 中同一路径始终复用同一个 FieldArray，确保行 key 稳定。
  const fieldArrays = new Map<string, FieldArrayInstance<TValues, never>>()

  const fieldArrayDisposers = new Map<string, () => void>()

  // 防止销毁后重复注册或释放响应式副作用。
  let disposed = false

  // Model 生命周期内注册的响应式副作用取消函数。
  const effectDisposers = new Set<() => void>()

  /**
   * 重置字段值并清空全部校验错误。
   */
  const reset: FormModel<TValues>["reset"] = () => {
    store.reset()
    validation.clearErrors()
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
   * 获取并缓存指定路径的 FieldArray 控制器。
   *
   * Controller 负责数组结构操作；Model 负责将结构变化转发给校验层，
   * 并在销毁时释放对应订阅。
   *
   * @param name - 动态数组字段路径。
   * @returns 当前 Form 中与该路径共享的 FieldArray 控制器。
   */
  const getOrCreateFieldArray = <TPath extends FieldArrayPath<TValues>>(
    name: TPath
  ): FieldArrayInstance<TValues, TPath> => {
    const key = createFieldKey(name)

    const cached = fieldArrays.get(key)

    if (cached) return cached as FieldArrayInstance<TValues, TPath>

    const fieldArrayHandle = store.getFieldArrayHandle(name)

    const array = createFieldArrayController<TValues, TPath>(
      fieldArrayHandle,
      name,
      batch
    )

    fieldArrays.set(key, array as FieldArrayInstance<TValues, never>)

    fieldArrayDisposers.set(
      key,
      fieldArrayHandle.subscribe((change) => {
        invalidateFieldArray(name, change)
      })
    )

    return array
  }

  /**
   * 仅执行一次并释放 Model 持有的全部资源。
   */
  const dispose: FormModel<TValues>["dispose"] = () => {
    if (disposed) {
      return
    }

    disposed = true
    fieldArrays.clear()
    for (const disposeFieldArray of fieldArrayDisposers.values()) {
      disposeFieldArray()
    }

    fieldArrayDisposers.clear()
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
    getOrCreateFieldArray,
    reset,
    effect,
    batch,
    dispose,
  }
}
