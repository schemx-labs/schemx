import { batchUpdates, createReactiveScope, createSignal } from "../reactivity"
import { createStore, type Store } from "../store"
import {
  createValidator,
  type CreateValidatorOptions,
  type Validator,
} from "../validator"

import type { ReadonlySignal } from "../reactivity"
import type {
  ApplyFormConfig,
  FormConfig,
  FormConfigModel,
  ResolvedFormConfig,
} from "./index"
import type { FormState, SchemxSchemaConfig, Values } from "../types"

/**
 * 创建 FormModel 所需的状态、校验和错误处理配置。
 *
 * @typeParam TValues - 表单值对象类型。
 */
export interface CreateFormModelOptions<TValues extends Values> {
  /**
   * 由 Form 先行创建并统一释放的配置模型。
   */
  configuration: FormConfigModel<TValues>
  /**
   * 创建 Store 时使用的初始值。
   */
  initialValues: TValues
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
   * Form 释放状态，用于结束无 Schema 节点的字段控制器。
   */
  readonly disposed: ReadonlySignal<boolean>
  /**
   * 供 Runtime 初次装配使用的生效配置。
   */
  getConfig(this: void): ResolvedFormConfig<TValues>
  /**
   * 替换唯一的消费配置。
   * @param config - 最高优先级的消费输入。
   * @param apply - 本次更新在状态发布前执行的编译提交。
   */
  setConfig(
    this: void,
    config: FormConfig<TValues>,
    apply?: ApplyFormConfig<TValues>
  ): void
  /**
   * 局部更新消费配置中的 Schema 默认值。
   * @param partial - 需要更新的默认属性。
   * @param apply - 本次更新在状态发布前执行的编译提交。
   */
  updateSchemaConfig(
    this: void,
    partial: Partial<SchemxSchemaConfig<TValues>>,
    apply?: ApplyFormConfig<TValues>
  ): void
  /**
   * 原生只读状态，直接复用 Store 状态与当前 Model 的提交状态。
   */
  readonly state: FormState<TValues>
  /**
   * 设置当前提交状态，由公开实例协调回调。
   * @param loading - 当前是否正在提交。
   */
  setLoading(loading: boolean): void
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
  dispose(this: void): void
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
 *   configuration,
 * })
 *
 * model.reset()
 * model.dispose()
 * ```
 */
export function createFormModel<TValues extends Values>(
  options: CreateFormModelOptions<TValues>
): FormModel<TValues> {
  // 配置由 Form 先行解析；Model 只管理值、提交状态和校验资源。
  const scope = createReactiveScope()

  const disposed = createSignal(false)

  const configuration = options.configuration

  const config = configuration.getConfig()

  const getConfig = configuration.getConfig

  const setConfig = configuration.setConfig

  const updateSchemaConfig = configuration.updateSchemaConfig

  // Store 保存字段值与交互状态。
  const store = createStore<TValues>({ initialValues: options.initialValues })

  const validation = createValidator<TValues>({
    fieldStore: store,
    presetRuleRegistry: config.presetRuleRegistry,
    validatorAdapters: config.validatorAdapters,
    onRuleError: options.onRuleError,
    validationConcurrency: config.validationConcurrency,
  })

  const loading = createSignal(false)

  const setLoading = (value: boolean): void => {
    loading.value = value
  }

  const state: FormState<TValues> = {
    ...store.state,
    config: configuration.state,
    loading: scope.state(() => loading.value),
  }

  const effect = scope.effect

  /**
   * 重置字段值并清空全部校验错误。
   */
  const reset: FormModel<TValues>["reset"] = () => {
    store.reset()
    store.clearAllErrors()
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
    if (scope.disposed) {
      return
    }

    disposed.value = true
    scope.dispose()
    validation.destroy()
    store.destroy()
  }

  return {
    disposed,
    getConfig,
    setConfig,
    updateSchemaConfig,
    state,
    setLoading,
    store,
    validation,
    reset,
    effect,
    batch,
    dispose,
  }
}
