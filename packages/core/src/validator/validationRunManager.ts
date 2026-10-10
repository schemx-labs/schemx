/**
 * 校验运行管理：同字段与全表轮次分别采用新运行优先，并统一释放取消资源。
 *
 * reset 和 destroy 由 Validator 的生命周期入口调用 cancelAll。
 *
 * @module core/validator/validationRunManager
 */

import type { ValidationRuleResult } from "./types"

/**
 * 单次字段或全表校验的运行句柄。
 */
export interface ValidationRun {
  // 提供给规则和子字段的取消信号。
  readonly signal: AbortSignal
  // 同时检查运行身份和取消状态，防止旧结果提交。
  isCurrent(): boolean
  // 中止运行并结束其异步等待。
  cancel(): void
  // 正常收尾：释放身份和父信号监听，不将成功运行标为中止。
  finish(): void
}

/**
 * Validator 内部的运行生命周期管理器。
 */
export interface ValidationRunManager {
  /**
   * 替换同字段的旧运行；已取消的父轮次不会抢占现有字段。
   *
   * @param key - 字段的稳定路径 key。
   * @param parentSignal - 可选的所属全表轮次信号。
   */
  startField(key: string, parentSignal?: AbortSignal): ValidationRun | undefined
  // 替换上一轮全表校验，父信号会同步取消旧轮所属字段。
  startForm(): ValidationRun
  /**
   * 因配置变化或字段移除取消当前字段。
   *
   * @param key - 字段的稳定路径 key。
   */
  cancelField(key: string): void
  // 取消调用开始时的全部运行，保留取消回调中新建的运行。
  cancelAll(): void
  /**
   * 等待规则完成或中止；晚到拒绝始终有处理器。
   *
   * @param result - 已启动的同步或异步规则结果。
   * @param signal - 当前字段信号，仅控制逻辑等待。
   */
  waitForRuleResult(
    result: ValidationRuleResult | Promise<ValidationRuleResult>,
    signal: AbortSignal
  ): Promise<ValidationRuleResult | undefined>
}

/**
 * 单次运行与所属管理器之间的身份和收尾约定。
 */
interface CreateValidationRunOptions {
  // 检查传入运行是否仍占用对应的字段或全表身份。
  readonly isCurrent: (run: ValidationRun) => boolean
  // 仅在传入运行仍为当前身份时移除它，避免旧收尾清理新运行。
  readonly onFinish: (run: ValidationRun) => void
  // 全表轮次通过父信号取消其字段运行。
  readonly parentSignal?: AbortSignal
}

/**
 * 创建只管理校验运行生命周期的内部管理器。
 *
 * @returns 新轮替换、取消、等待及资源清理接口。
 *
 * @example
 * ```ts
 * const manager = createValidationRunManager()
 * const run = manager.startForm()
 * try {
 *   const field = manager.startField("email", run.signal)
 *   if (field?.isCurrent()) console.log(field.signal.aborted)
 *   field?.finish()
 * } finally {
 *   run.finish()
 * }
 * ```
 */
export function createValidationRunManager(): ValidationRunManager {
  // 每个字段仅保留当前运行身份。
  const fields = new Map<string, ValidationRun>()

  // 全表校验只有一个当前轮次。
  let form: ValidationRun | undefined

  // @param key - 要取消的字段稳定 key。
  const cancelField = (key: string): void => {
    fields.get(key)?.cancel()
  }

  // @param key - 字段稳定 key；parentSignal - 所属全表轮次的取消信号。
  const startField = (
    key: string,
    parentSignal?: AbortSignal
  ): ValidationRun | undefined => {
    if (parentSignal?.aborted) {
      return undefined
    }

    cancelField(key)
    const run = createValidationRun({
      parentSignal,
      isCurrent: (current) => fields.get(key) === current,
      onFinish: (current) => {
        if (fields.get(key) === current) {
          fields.delete(key)
        }
      },
    })

    if (run.signal.aborted) {
      return undefined
    }

    fields.set(key, run)

    return run
  }

  // 先发布新轮身份，再取消旧轮，保持同步取消回调中的新轮优先。
  const startForm = (): ValidationRun => {
    const previous = form

    const run = createValidationRun({
      isCurrent: (current) => form === current,
      onFinish: (current) => {
        if (form === current) {
          form = undefined
        }
      },
    })

    form = run
    previous?.cancel()

    return run
  }

  // 固定本次取消范围，旧运行的收尾不会删除回调中新建的字段。
  const cancelAll = (): void => {
    const runs = Array.from(fields.values())

    form?.cancel()
    for (const run of runs) {
      run.cancel()
    }
  }

  return {
    startField,
    startForm,
    cancelField,
    cancelAll,
    waitForRuleResult,
  }
}

/**
 * 关联父信号并创建带身份保护的运行句柄。
 *
 * @param options - 当前身份判断、收尾回调和可选父轮次信号。
 */
function createValidationRun(options: CreateValidationRunOptions): ValidationRun {
  // 控制器只在此处持有，调用方通过运行句柄操作生命周期。
  const controller = new AbortController()

  // 身份检查同时排除被中止或已正常收尾的运行。
  const isCurrent = (): boolean => {
    return !controller.signal.aborted && options.isCurrent(run)
  }

  // 收尾可重复调用；身份回调负责保护新运行。
  const finish = (): void => {
    options.parentSignal?.removeEventListener("abort", cancel)
    options.onFinish(run)
  }

  // 先释放身份，再触发同步取消回调。
  const cancel = (): void => {
    finish()
    controller.abort()
  }

  // 父监听安装前完成句柄初始化，允许处理已中止的父信号。
  const run: ValidationRun = {
    signal: controller.signal,
    isCurrent,
    cancel,
    finish,
  }

  options.parentSignal?.addEventListener("abort", cancel, { once: true })
  if (options.parentSignal?.aborted) {
    cancel()
  }

  return run
}

/**
 * 等待规则结果或取消，忽略信号的旧 Promise 也不会阻塞新轮。
 *
 * @param result - 已启动的同步或异步规则结果。
 * @param signal - 当前字段的取消信号，仅取消逻辑等待。
 */
function waitForRuleResult(
  result: ValidationRuleResult | Promise<ValidationRuleResult>,
  signal: AbortSignal
): Promise<ValidationRuleResult | undefined> {
  return new Promise((resolve, reject) => {
    // 中止后立即释放监听，晚到完成仍由下面的处理器接收。
    const onAbort = (): void => {
      signal.removeEventListener("abort", onAbort)
      resolve(undefined)
    }

    signal.addEventListener("abort", onAbort, { once: true })

    void Promise.resolve(result).then(
      (value) => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      }
    )

    if (signal.aborted) {
      onAbort()
    }
  })
}
