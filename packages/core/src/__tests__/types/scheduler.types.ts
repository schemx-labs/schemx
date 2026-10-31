import type { SchedulerOptions, SchedulerTaskPriority } from "../../index"
import type { Scheduler } from "../../scheduler"

// 新接口只有 normal/post 阶段及一种完成等待语义。
declare const scheduler: Scheduler
const options: SchedulerOptions = { timeSliceMs: 5, collectDiagnostics: true }

const priority: SchedulerTaskPriority = "post"

void options
void priority
scheduler.whenIdle(100)
scheduler.track(Promise.resolve())
// @ts-expect-error 后台 idle 阶段已移除。
const removedPriority: SchedulerTaskPriority = "idle"

// @ts-expect-error 浏览器空闲回调的超时配置已移除。
const removedOptions: SchedulerOptions = { idleTimeout: 10 }

// @ts-expect-error 不再支持范围等待参数。
scheduler.whenIdle({ includeIdle: false })
// @ts-expect-error 异步任务统一参与完成判断，不再接收阶段配置。
scheduler.track(Promise.resolve(), { priority: "normal" })
void removedPriority
void removedOptions
