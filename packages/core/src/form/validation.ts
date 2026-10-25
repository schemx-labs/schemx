/**
 * Form 校验编排。
 *
 * 统一协调 Runtime 依赖等待、字段路径取消、规则元数据及整表 pending 检查。
 * 公开方法的并发锁、提交状态与业务回调由 Instance 持有。
 *
 * @module core/form/validation
 */

import { runSignalUntracked } from "../reactivity"
import { findFieldNode } from "../runtime/node"
import { shouldValidateOn } from "../utils"
import { createValidationCancelled, createValidationFailure } from "../validator"

import type { FormModel } from "./index"
import type { SchemaRuntime } from "../runtime"
import type { ResolvedFieldSchema } from "../runtime/node"
import type { StorePending } from "../store"
import type { FieldRules, NamePath, SchemxBaseField, Values } from "../types"
import type {
  FieldValidationConfig,
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
   * 表单值、重置版本和 Validator 所属的 Model。
   */
  readonly model: FormModel<TValues>
  /**
   * 提供字段有效配置及关键依赖空闲边界。
   */
  readonly runtime: SchemaRuntime<TValues>
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
 * Instance 复用的字段与整表校验操作；不拥有独立资源生命周期。
 * @typeParam TValues - 表单值类型。
 */
export interface FormValidation<TValues extends Values> {
  /**
   * 捕获本次操作的路径绑定，节点改名或移除后信号被取消。
   * @param name - 操作开始时的字段路径。
   */
  getFieldPathSignal(this: void, name: NamePath<TValues>): AbortSignal | undefined
  /**
   * 读取当前字段配置；手动字段回退表单默认值。
   * @param name - 当前字段路径。
   */
  getFieldContext(
    this: void,
    name: NamePath<TValues>
  ): Partial<ResolvedFieldSchema<TValues>>
  /**
   * 执行显式字段校验。
   * @typeParam TName - 当前字段路径，用于收窄返回的字段错误。
   * @param name - 要校验的字段路径。
   * @param event - 省略事件表示显式校验。
   * @param signal - 可选的路径取消信号。
   * @example await validation.validateField("email")
   */
  validateField<TName extends NamePath<TValues>>(
    this: void,
    name: TName,
    event?: undefined,
    signal?: AbortSignal
  ): Promise<ValidationResult<TValues, TName>>
  /**
   * 按交互事件执行字段校验。
   * @typeParam TName - 当前字段路径，用于收窄返回的字段错误。
   * @param name - 要校验的字段路径。
   * @param event - change 或 blur 交互事件。
   * @param signal - 本次交互捕获的路径取消信号。
   * @example await validation.validateField("email", "blur", signal)
   */
  validateField<TName extends NamePath<TValues>>(
    this: void,
    name: TName,
    event: "change" | "blur",
    signal?: AbortSignal
  ): Promise<ValidationResult<TValues, TName> | undefined>
  /**
   * 设置公开规则覆盖，并补齐当前 Schema 的元数据。
   * @typeParam TName - 当前字段路径。
   * @param name - 要设置规则的字段路径。
   * @param rules - 优先于 Schema 声明的规则覆盖。
   */
  setFieldRules<TName extends NamePath<TValues>>(
    this: void,
    name: TName,
    rules: FieldRules<TValues, TName>
  ): void
  /**
   * 执行未加锁的整表校验。
   * @param resetRevision - 公开入口在执行任何业务回调前捕获的重置版本。
   */
  runFormValidation(
    this: void,
    resetRevision: number
  ): Promise<FormValidationRun<TValues>>
}

/**
 * 字段交互和校验共同使用的有效呈现状态。
 */
type FieldInteractionState = Pick<SchemxBaseField, "visible" | "readonly" | "disabled">

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
 * 创建只依赖 Model、Runtime 的校验流程。
 * @typeParam TValues - 表单值类型。
 * @param options - 字段状态、Validator 和 Runtime 依赖。
 * @returns 不带并发锁与业务回调的校验操作。
 * @example
 * const validation = createFormValidation({ model, runtime })
 * const resetRevision = model.store.getResetRevision()
 * const { result } = await validation.runFormValidation(resetRevision)
 */
export function createFormValidation<TValues extends Values>(
  options: CreateFormValidationOptions<TValues>
): FormValidation<TValues> {
  // 两个子系统由 Form 统一释放，本模块只在一次等待期间持有临时监听。
  const { model, runtime } = options

  /**
   * 无 Schema 的手动字段使用同一份表单默认配置。
   * @param name - 当前字段路径。
   */
  const getFieldContext = (
    name: NamePath<TValues>
  ): Partial<ResolvedFieldSchema<TValues>> =>
    runtime.getFieldRuleContext(name) ?? model.getConfig().schemaConfig

  /**
   * 为 Schema 校验与手动规则构造同一份元数据。
   * @typeParam TName - 当前字段路径。
   * @param name - 要更新校验元数据的字段路径。
   * @param context - Runtime 的当前 Schema；手动字段缺省时保持默认激活状态。
   */
  const createFieldValidationConfig = <TName extends NamePath<TValues>>(
    name: TName,
    context: ResolvedFieldSchema<TValues> | undefined
  ): FieldValidationConfig<TValues, TName> => ({
    name,
    label: context?.label ?? "",
    placeholder: context?.placeholder ?? "",
    // Runtime 已按当前路径定位字段；断言只恢复该路径对应的值类型。
    required: (context?.required ?? false) as FieldValidationConfig<
      TValues,
      TName
    >["required"],
    active: context === undefined || isFieldInteractive(context),
  })

  /**
   * 在公开操作开始时捕获目标节点的路径绑定，异步等待不再操作同址替换节点。
   * @param name - 本次操作开始时的字段路径。
   */
  const getFieldPathSignal = (name: NamePath<TValues>): AbortSignal | undefined => {
    return runtime.isDisposed()
      ? undefined
      : runSignalUntracked(() => findFieldNode(runtime.root, name)?.pathController.signal)
  }

  /**
   * 等待依赖稳定；重置或节点路径失效时提前结束，不继续启动校验。
   * @param signal - 当前节点路径绑定的可选取消信号。
   */
  const waitForCriticalIdle = async (
    signal?: AbortSignal
  ): Promise<DependencyIdleState> => {
    if (signal?.aborted) return { ready: false, cancelled: true }

    if (runtime.isDisposed()) return { ready: true, cancelled: false }

    // reset 和路径取消共同完成同一个取消分支。
    let cancel = (): void => {}

    // 与 Runtime 空闲等待竞争，防止重置后仍等待旧依赖。
    const cancellation = new Promise<void>((resolve) => {
      cancel = resolve
    })

    // 无论竞争结果如何，结束时都解除本次等待的监听。
    const unsubscribe = model.store.subscribeResets(cancel)

    signal?.addEventListener("abort", cancel, { once: true })

    try {
      return await Promise.race([
        runtime.waitForCriticalIdle().then((ready) => ({ ready, cancelled: false })),
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
    const resetRevision = model.store.getResetRevision()

    // 只等待关键依赖，后台 idle 任务不阻塞校验。
    const dependencyState = await waitForCriticalIdle(signal)

    if (
      signal?.aborted ||
      dependencyState.cancelled ||
      model.store.getResetRevision() !== resetRevision
    ) {
      return createValidationCancelled<TValues>(model.store.getFieldsSnapshot())
    }

    if (event) {
      if (runtime.isDisposed()) {
        return createValidationCancelled<TValues>(model.store.getFieldsSnapshot())
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
      return createDependencyTimeoutResult<TValues, TName>(
        model.store.getFieldsSnapshot()
      )
    }

    // 只有 Schema 字段需要刷新元数据，手动字段保留已有配置。
    const context = runtime.getFieldRuleContext(name)

    if (context) {
      model.validation.setFieldConfig(createFieldValidationConfig(name, context))
    }

    // Validator 管理规则执行取消；当前入口继续校验路径和重置版本。
    const result = await model.validation.validateField(
      name,
      model.store.getFieldsValue(),
      signal
    )

    if (signal?.aborted || model.store.getResetRevision() !== resetRevision) {
      return createValidationCancelled<TValues>(model.store.getFieldsSnapshot())
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
    const values = model.store.getFieldsSnapshot()

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

    model.store.setFieldsErrors(
      errors.map(({ name, issues }) => ({
        field: name,
        errors: [
          ...model.store.getFieldErrors(name).filter((issue) => issue.code !== "pending"),
          ...issues,
        ],
      }))
    )

    return createValidationFailure(values, errors)
  }

  // pending 预检和收尾检查分别覆盖校验前、异步校验期间的业务操作。
  const validateAfterIdle = async (): Promise<ValidationResult<TValues>> => {
    // 尚在操作中的字段直接阻止整表校验。
    const pendingFields = model.store.getPendingFields()

    if (pendingFields.length > 0) {
      return applyPendingFailure(pendingFields)
    }

    // 此处不加锁，由 validate 与 submit 分别协调各自的并发调用。
    const result = await model.validation.validate(model.store.getFieldsValue())

    if (!result.valid && result.cancelled) return result

    // 异步规则执行期间也可能开始新的上传等业务操作。
    const pendingAfterValidation = model.store.getPendingFields()

    return pendingAfterValidation.length > 0
      ? applyPendingFailure(pendingAfterValidation)
      : result
  }

  // 手动规则覆盖复用与显式校验相同的字段元数据解析。
  const setFieldRules: FormValidation<TValues>["setFieldRules"] = (name, rules) => {
    model.validation.setFieldConfig(
      createFieldValidationConfig(name, runtime.getFieldRuleContext(name))
    )
    model.validation.setManualFieldRules(name, rules)
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
    const mutationRevision = model.store.getMutationRevision()

    // 取消和超时也交由调用入口处理，避免在这里派发业务回调。
    let result: ValidationResult<TValues>

    if (dependency.cancelled || model.store.getResetRevision() !== resetRevision) {
      result = createValidationCancelled(model.store.getFieldsSnapshot())
    } else if (!dependency.ready) {
      result = createDependencyTimeoutResult(model.store.getFieldsSnapshot())
    } else {
      result = await validateAfterIdle()
    }

    return { result, mutationRevision }
  }

  return {
    getFieldPathSignal,
    getFieldContext,
    validateField,
    setFieldRules,
    runFormValidation,
  }
}

/**
 * 判断字段是否允许交互和参与有效校验。
 * @param context - 当前字段的可见、只读和禁用状态。
 * @example const active = isFieldInteractive({ visible: true, readonly: false, disabled: false })
 */
export function isFieldInteractive(context: FieldInteractionState): boolean {
  return (
    context.visible !== false && context.readonly !== true && context.disabled !== true
  )
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
