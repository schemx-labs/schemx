/**
 * Scheduler 模块统一导出。
 *
 * 提供异步任务调度和异步计算封装。
 *
 * @module core/scheduler
 */

export {
  createAbortableTaskRunner,
  type AbortableTaskRunner,
  type AbortableTaskRunnerOptions,
} from "./abortableTaskRunner"

export {
  createScheduler,
  type Scheduler,
  type SchedulerDiagnostics,
  type SchedulerOptions,
  type ScheduledTask,
  type SchedulerTaskPriority,
  yieldToHost,
} from "./scheduler"

export type { CancellableTask } from "./scheduler"
