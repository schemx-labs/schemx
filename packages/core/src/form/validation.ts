/**
 * Form 校验编排。
 *
 * 统一协调调度器依赖等待、字段路径取消、规则元数据及整表 pending 检查。
 * Validator、规则操作和公开方法的并发锁由本域持有，提交状态由 Form 注入。
 *
 * @module core/form/validation
 */

import { isFieldNode } from "../node"
import { batchUpdates, runSignalUntracked } from "../reactivity"
import { isFieldInteractive, shouldValidateOn, withLock } from "../utils"
import {
  createValidationCancelled,
  createValidationFailure,
  createValidator,
} from "../validator"

import { createFormRules } from "./rules"

import type { FormRulesApi } from "./rules"
import type { FormCallbackOptions } from "../config"
import type { FormConfigModel } from "../config/createFormConfig"
import type { NodeManager } from "../node"
import type { ReadonlySignal } from "../reactivity"
import type { RuntimeValidationPort } from "../runtimeContext"
import type { Scheduler } from "../scheduler"
import type { Store, StorePending } from "../store"
import type {
  FieldValue,
  NamePath,
  SchemxFormApi,
  SchemxInstance,
  Values,
} from "../types"
import type {
  CreateValidatorOptions,
  FieldValidationError,
  ValidationFailure,
  ValidationResult,
  ValidationRuleIssue,
} from "../validator"

/**
 * 校验流程使用的稳定依赖。
 * @typeParam TValues - 表单值类型。
 */
export interface CreateFormValidationOptions<TValues extends Values> {
  /**
   * Form 拥有的字段值与交互状态。
   */
  readonly store: Store<TValues>
  /**
   * 提供固定创建选项和当前字段默认配置的模型。
   */
  readonly configuration: FormConfigModel<TValues>
  /**
   * 将规则执行异常转换为字段错误消息。
   */
  readonly onRuleError?: CreateValidatorOptions<TValues>["onRuleError"]
  /**
   * Form 独占的提交状态。
   */
  readonly loading: ReadonlySignal<boolean>
  /**
   * 提交开始和结束时通知业务回调。
   * @param value - 是否正在提交。
   */
  setLoading(value: boolean): void
  /**
   * 提交结果与 loading 变化回调。
   */
  readonly callbacks: FormCallbacks<TValues>
  /**
   * 获取完成装配的稳定实例，供字段业务回调使用。
   */
  readonly getInstance: () => SchemxInstance<TValues>
  /**
   * 读取 Form 统一的表单级销毁状态。
   */
  isDisposed(): boolean
  /**
   * 提供字段身份、当前路径和有效配置。
   */
  readonly nodeManager: NodeManager<TValues>
  /**
   * 提供关键依赖空闲边界。
   */
  readonly scheduler: Scheduler
}

/**
 * 一次整表校验结果及其开始校验时的值版本。
 * @typeParam TValues - 表单值类型。
 */
export interface FormValidationRun<TValues extends Values> {
  /**
   * 校验结果；重置后的最终作废判断仍由调用入口完成。
   */
  readonly result: ValidationResult<TValues>
  /**
   * 仅成功结果需要用此版本判断校验期间是否发生过值写入。
   */
  readonly mutationRevision: number
}

/**
 * 提交和 reset 事件共享的业务回调。
 * @typeParam TValues - 表单值类型。
 */
export type FormCallbacks<TValues extends Values> = Pick<
  FormCallbackOptions<TValues>,
  "onFinish" | "onFinishFailed" | "onReset" | "onLoadingChange"
>

/**
 * 校验域的公开入口，validate 和 submit 分别使用独立锁。
 * @typeParam TValues - 表单值类型。
 */
export type FormValidationApi<TValues extends Values> = Pick<
  SchemxInstance<TValues>,
  "validateField" | "validate" | "submit" | "changeField" | "blurField" | "isLoading"
>

/**
 * 校验编排的公开投影。
 * @typeParam TValues - 表单值类型。
 */
export interface FormValidation<TValues extends Values> {
  /**
   * 单字段、整表及交互校验。
   */
  readonly api: FormValidationApi<TValues>
  /**
   * 与公开校验共享同一 Validator 的规则操作。
   */
  readonly rulesApi: FormRulesApi<TValues>
  /**
   * 供节点模块使用的同一校验器窄端口。
   */
  readonly validator: RuntimeValidationPort<TValues>
  /**
   * 释放校验器的运行和订阅，具体清理时机由 Form 安排。
   * @example validation.dispose()
   */
  dispose(this: void): void
}

/**
 * 关键依赖等待的结果；重置或路径失效与超时分开处理。
 */
interface DependencyIdleState {
  /**
   * 关键队列是否已在超时前完成。
   */
  readonly ready: boolean
  /**
   * 本次等待是否因重置或路径失效而提前结束。
   */
  readonly cancelled: boolean
}

/**
 * 创建由 Form 装配的字段和整表校验流程。
 * @typeParam TValues - 表单值类型。
 * @param options - 字段状态、配置模型、节点索引、调度器及业务回调。
 * @returns 公开校验与规则操作、共享校验端口及幂等清理入口。
 * @example
 * const validation = createFormValidation(validationOptions)
 * await validation.api.validate()
 */
export function createFormValidation<TValues extends Values>(
  options: CreateFormValidationOptions<TValues>
): FormValidation<TValues> {
  // 值状态、规则元数据与节点终态来自同一 Form。
  const {
    store,
    configuration,
    onRuleError,
    nodeManager,
    scheduler,
    isDisposed,
    loading,
    setLoading,
    callbacks,
    getInstance,
  } = options

  // 创建选项固定；字段元数据在操作时继续读取配置模型。
  const config = configuration.getConfig()

  // 规则和公开校验都使用这一份原始资源。
  const validator = createValidator<TValues>({
    fieldStore: store,
    presetRuleRegistry: config.presetRuleRegistry,
    validatorAdapters: config.validatorAdapters,
    validationConcurrency: config.validationConcurrency,
    onRuleError,
  })

  // 清理入口保持接收者绑定，并复用 Validator 的幂等销毁行为。
  const dispose = validator.destroy.bind(validator)

  try {
    // 校验器创建后立即装配规则元数据与公开规则操作。
    const rules = createFormRules({
      validator,
      configuration,
      nodeManager,
      presetRuleRegistry: config.presetRuleRegistry,
    })

    // 交互和显式校验读取同一份当前元数据。
    const getFieldContext = rules.getFieldContext

    /**
     * 在公开操作开始时捕获目标节点的路径绑定，异步等待不再操作同址替换节点。
     * @param name - 本次操作开始时的字段路径。
     */
    const getFieldPathSignal = (name: NamePath<TValues>): AbortSignal | undefined => {
      if (isDisposed()) {
        return undefined
      }

      return runSignalUntracked(() => {
        // NodeId 确定本次操作的字段身份，controller 区分该节点的每次路径绑定。
        const [nodeId] = nodeManager.getNodeIds(name)

        const node = nodeId === undefined ? undefined : nodeManager.get(nodeId)

        return isFieldNode(node) ? node.pathController.signal : undefined
      })
    }

    /**
     * 等待依赖稳定；重置或节点路径失效时提前结束，不继续启动校验。
     * @param signal - 当前节点路径绑定的可选取消信号。
     */
    const waitForCriticalIdle = async (
      signal?: AbortSignal
    ): Promise<DependencyIdleState> => {
      if (signal?.aborted) return { ready: false, cancelled: true }

      if (isDisposed()) return { ready: true, cancelled: false }

      // reset 和路径取消共同完成同一个取消分支。
      let cancel = (): void => {}

      // 与调度器空闲等待竞争，防止重置后仍等待旧依赖。
      const cancellation = new Promise<void>((resolve) => {
        cancel = resolve
      })

      // 无论竞争结果如何，结束时都解除本次等待的监听。
      const unsubscribe = store.subscribeResets(cancel)

      signal?.addEventListener("abort", cancel, { once: true })

      try {
        return await Promise.race([
          scheduler
            .whenIdle({ timeout: 10000, includeIdle: false })
            .then((ready) => ({ ready, cancelled: false })),
          cancellation.then(() => ({ ready: false, cancelled: true })),
        ])
      } finally {
        unsubscribe()
        signal?.removeEventListener("abort", cancel)
      }
    }

    /**
     * 显式校验字段；不受交互触发时机限制。
     * @typeParam TName - 当前字段路径。
     * @param name - 要校验的字段路径。
     * @param event - 省略事件表示显式校验。
     * @param signal - 可选的路径绑定取消信号。
     * @example await validateField("email")
     */
    function validateField<TName extends NamePath<TValues>>(
      name: TName,
      event?: undefined,
      signal?: AbortSignal
    ): Promise<ValidationResult<TValues, TName>>
    /**
     * 交互校验在依赖稳定后重新检查字段状态和触发时机。
     * @typeParam TName - 当前字段路径。
     * @param name - 要校验的字段路径。
     * @param event - 当前用户交互事件。
     * @param signal - 本次交互开始时捕获的路径取消信号。
     * @example await validateField("email", "blur", signal)
     */
    function validateField<TName extends NamePath<TValues>>(
      name: TName,
      event: "change" | "blur",
      signal?: AbortSignal
    ): Promise<ValidationResult<TValues, TName> | undefined>
    // 两种入口共用取消检查，异步等待后不再写入已失效的路径。
    async function validateField<TName extends NamePath<TValues>>(
      name: TName,
      event?: "change" | "blur",
      signal?: AbortSignal
    ): Promise<ValidationResult<TValues, TName> | undefined> {
      signal ??= getFieldPathSignal(name)

      // 重置版本必须在任何等待之前捕获。
      const resetRevision = store.getResetRevision()

      // 只等待关键依赖，后台 idle 任务不阻塞校验。
      const dependencyState = await waitForCriticalIdle(signal)

      if (
        signal?.aborted ||
        dependencyState.cancelled ||
        store.getResetRevision() !== resetRevision
      ) {
        return createValidationCancelled<TValues>(store.getFieldsSnapshot())
      }

      if (event) {
        if (isDisposed()) {
          return createValidationCancelled<TValues>(store.getFieldsSnapshot())
        }

        // 使用等待后的当前配置，避免采用交互开始时的过期状态。
        const context = getFieldContext(name)

        if (
          !isFieldInteractive(context) ||
          !shouldValidateOn(event, context.validationTrigger)
        ) {
          return undefined
        }
      }

      if (!dependencyState.ready) {
        return createDependencyTimeoutResult<TValues, TName>(store.getFieldsSnapshot())
      }

      rules.updateFieldConfig(name)

      // Validator 管理规则执行取消；当前入口继续校验路径和重置版本。
      const result = await validator.validateField(name, store.getFieldsValue(), signal)

      if (signal?.aborted || store.getResetRevision() !== resetRevision) {
        return createValidationCancelled<TValues>(store.getFieldsSnapshot())
      }

      return result
    }

    /**
     * 将操作中字段写为 pending 错误，并返回本次失败快照。
     * @param pendingFields - 本次已扫描出的操作中字段，避免重复扫描。
     */
    const applyPendingFailure = (
      pendingFields: readonly StorePending<TValues, NamePath<TValues>>[]
    ): ValidationResult<TValues> => {
      // 保留当前业务提示及日志行为。
      const defaultMessage = `存在正在操作中的字段: ${pendingFields.map((item) => item.field).join(", ")}，请等待完成后再提交`

      console.warn(`[schemx] ${defaultMessage}`)

      // 在写入错误触发订阅回调前保留本次值快照。
      const values = store.getFieldsSnapshot()

      // 返回本次 pending 问题；Store 中其他来源的错误另外保留。
      const errors = pendingFields.map<FieldValidationError<NamePath<TValues>>>(
        ({ field, message }) => {
          // 至少保留一条提示，使字段错误始终满足非空约束。
          const [first = "字段正在处理中，请稍后重试", ...rest] = message

          // 结构化问题保留 pending 来源，后续更新只替换同来源错误。
          const issues: [ValidationRuleIssue, ...ValidationRuleIssue[]] = [
            { type: "external", message: first, code: "pending" },
            ...rest.map<ValidationRuleIssue>((item) => ({
              type: "external",
              message: item,
              code: "pending",
            })),
          ]

          return { scope: "field", name: field, issues }
        }
      )

      store.setFieldsErrors(
        errors.map(({ name, issues }) => ({
          field: name,
          errors: [
            ...store.getFieldErrors(name).filter((issue) => issue.code !== "pending"),
            ...issues,
          ],
        }))
      )

      return createValidationFailure(values, errors)
    }

    // pending 预检和收尾检查分别覆盖校验前、异步校验期间的业务操作。
    const validateAfterIdle = async (): Promise<ValidationResult<TValues>> => {
      // 尚在操作中的字段直接阻止整表校验。
      const pendingFields = store.getPendingFields()

      if (pendingFields.length > 0) {
        return applyPendingFailure(pendingFields)
      }

      // 此处不加锁，由 validate 与 submit 分别协调各自的并发调用。
      const result = await validator.validate(store.getFieldsValue())

      if (!result.valid && result.cancelled) return result

      // 异步规则执行期间也可能开始新的上传等业务操作。
      const pendingAfterValidation = store.getPendingFields()

      return pendingAfterValidation.length > 0
        ? applyPendingFailure(pendingAfterValidation)
        : result
    }

    /**
     * 执行未加锁的整表校验；业务回调、loading 和最终版本检查由公开入口处理。
     * @param resetRevision - 入口在 loading 等业务回调之前捕获的重置版本。
     */
    const runFormValidation = async (
      resetRevision: number
    ): Promise<FormValidationRun<TValues>> => {
      // 重置可提前终止依赖等待；本流程只负责生成校验结果。
      const dependency = await waitForCriticalIdle()

      // 采样点位于依赖稳定之后、校验之前，submit 用它拒绝过期成功结果。
      const mutationRevision = store.getMutationRevision()

      // 取消和超时也交由调用入口处理，避免在这里派发业务回调。
      let result: ValidationResult<TValues>

      if (dependency.cancelled || store.getResetRevision() !== resetRevision) {
        result = createValidationCancelled(store.getFieldsSnapshot())
      } else if (!dependency.ready) {
        result = createDependencyTimeoutResult(store.getFieldsSnapshot())
      } else {
        result = await validateAfterIdle()
      }

      return { result, mutationRevision }
    }

    /**
     * 读取 Form 的提交状态，不在 API 内创建第二份状态。
     * @example const loading = formApi.isLoading()
     */
    const isLoading: SchemxFormApi<TValues>["isLoading"] = () => loading.value

    // 并发锁属于同一 Form 共享的消费端 API，与 submit 的锁分开。
    const validate: SchemxFormApi<TValues>["validate"] = withLock(async () => {
      // 等待开始前采样重置版本，拒绝使用重置之前的结果。
      const resetRevision = store.getResetRevision()

      const { result } = await runFormValidation(resetRevision)

      if (store.getResetRevision() !== resetRevision) {
        return createValidationCancelled(store.getFieldsSnapshot())
      }

      return result
    })

    // submit 额外负责值版本检查、loading 与业务回调，不调用带锁的 validate。
    const submit: SchemxInstance<TValues>["submit"] = withLock(async () => {
      // 必须早于 onLoadingChange；回调本身也可能同步触发表单重置。
      const resetRevision = store.getResetRevision()

      try {
        setLoading(true)

        // 值版本在内部等待依赖稳定后采样，依赖更新不会误作废本次提交。
        const { result, mutationRevision } = await runFormValidation(resetRevision)

        if (
          store.getResetRevision() !== resetRevision ||
          (result.valid && store.getMutationRevision() !== mutationRevision)
        ) {
          return createValidationCancelled(store.getFieldsSnapshot())
        }

        if (result.valid) {
          await callbacks.onFinish?.(result.values)
        } else if (!result.cancelled) {
          callbacks.onFinishFailed?.(result)
        }

        return result
      } finally {
        // 销毁或其他流程已结束 loading 时，不重复派发关闭回调。
        if (loading.value) {
          setLoading(false)
        }
      }
    })

    // 以下动作需要完整的实例身份；函数声明可在组装时引用，执行时实例已就绪。
    /**
     * 用户交互先同步提交状态和业务回调，再复用单字段校验流程。
     * @typeParam TName - 当前字段路径。
     * @param name - 本次交互绑定的路径。
     * @param event - change 或 blur 事件。
     * @param value - change 写入的新值；blur 忽略此参数。
     * @param signal - 交互开始时捕获的路径取消信号。
     */
    async function interactField<TName extends NamePath<TValues>>(
      name: TName,
      event: "change" | "blur",
      value?: FieldValue<TValues, TName>,
      signal?: AbortSignal
    ): Promise<ValidationResult<TValues, TName> | undefined> {
      if (isDisposed() || signal?.aborted) {
        return undefined
      }

      // 业务回调读取交互开始时的配置，自动校验随后重新检查最新配置。
      const context = getFieldContext(name)

      if (!isFieldInteractive(context)) {
        return undefined
      }

      // 业务回调和状态订阅都可能同步重置表单。
      const resetRevision = store.getResetRevision()

      batchUpdates(() => {
        if (event === "change") {
          store.setFieldValue(name, () => value)
        }

        store.setFieldTouched(name, true)
      })

      if (signal?.aborted || isDisposed() || store.getResetRevision() !== resetRevision) {
        return createValidationCancelled<TValues>(store.getFieldsSnapshot())
      }

      if (event === "change") {
        context.onChange?.(value, getInstance())
      } else {
        context.onBlur?.(getInstance())
      }

      if (signal?.aborted || isDisposed() || store.getResetRevision() !== resetRevision) {
        return createValidationCancelled<TValues>(store.getFieldsSnapshot())
      }

      if (!shouldValidateOn(event, getFieldContext(name).validationTrigger)) {
        return undefined
      }

      return validateField(name, event, signal)
    }

    /**
     * 进入异步流程前捕获路径，数组移动后旧事件不会写入替换字段。
     * @typeParam TName - 本次交互的字段路径。
     * @param name - 操作开始时的路径。
     * @param value - 用户提交的新字段值。
     */
    function changeField<TName extends NamePath<TValues>>(
      name: TName,
      value: FieldValue<TValues, TName> | undefined
    ): Promise<ValidationResult<TValues, TName> | undefined> {
      return interactField(name, "change", value, getFieldPathSignal(name))
    }

    /**
     * 复用交互守卫，保持触摸、回调与校验的顺序。
     * @typeParam TName - 本次交互的字段路径。
     * @param name - 操作开始时的路径。
     */
    function blurField<TName extends NamePath<TValues>>(
      name: TName
    ): Promise<ValidationResult<TValues, TName> | undefined> {
      return interactField(name, "blur", undefined, getFieldPathSignal(name))
    }

    // 表单 API 和实例复用相同方法及校验锁。
    const api: FormValidationApi<TValues> = {
      validateField,
      validate,
      submit,
      changeField,
      blurField,
      isLoading,
    }

    return { api, rulesApi: rules.api, validator, dispose }
  } catch (error) {
    // 尚未返回给 Form 的校验资源由本模块负责释放。
    dispose()
    throw error
  }
}

/**
 * 创建依赖解析超时的表单级失败结果。
 *
 * @typeParam TValues - 表单值对象类型。
 * @typeParam TName - 保留字段校验调用方的路径类型。
 * @param values - 超时发生时应保留的表单值快照。
 * @returns 表示依赖解析超时的失败结果。
 */
function createDependencyTimeoutResult<
  TValues extends Values,
  TName extends NamePath<TValues> = NamePath<TValues>,
>(values: TValues): ValidationFailure<TValues, TName> {
  return createValidationFailure<TValues, TName>(values, [
    {
      scope: "form",
      issues: [
        {
          type: "validation",
          message: "表单依赖解析超时，请稍后重试",
          code: "dependency_timeout",
        },
      ],
    },
  ])
}
