/**
 * 工作流错误。统一携带进程退出码，避免用返回值在调用栈里传递状态。
 */

/** 约定退出码：用户主动取消。 */
export const CANCELLED_EXIT_CODE = 130

/** 约定退出码：用法错误或输入校验失败。 */
export const USAGE_EXIT_CODE = 2

/**
 * 带退出码的工作流错误。
 */
export class WorkflowError extends Error {
  /** 进程退出码。 */
  readonly exitCode: number

  /**
   * @param message - 面向用户的错误说明。
   * @param exitCode - 进程退出码，默认按用法错误处理。
   */
  constructor(message: string, exitCode: number = USAGE_EXIT_CODE) {
    super(message)
    this.name = "WorkflowError"
    this.exitCode = exitCode
  }
}

/**
 * 构造用法错误。
 *
 * @param message - 错误说明。
 * @returns 用法错误实例。
 */
export function usageError(message: string): WorkflowError {
  return new WorkflowError(message, USAGE_EXIT_CODE)
}

/**
 * 构造操作失败错误。
 *
 * @param message - 错误说明。
 * @returns 携带退出码 1 的错误实例。
 */
export function failure(message: string): WorkflowError {
  return new WorkflowError(message, 1)
}

/**
 * 构造用户取消错误。
 *
 * @param message - 错误说明。
 * @returns 携带退出码 130 的错误实例。
 */
export function cancelled(message = "操作已取消。"): WorkflowError {
  return new WorkflowError(message, CANCELLED_EXIT_CODE)
}
