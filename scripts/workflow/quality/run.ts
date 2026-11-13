/**
 * 普通检查与发布共用的质量任务执行器。
 */
import { runWorkflowCommand, runWorkflowTask } from "../presentation.ts"

import {
  checkQualityArtifacts,
  checkQualityConfig,
  previewQualityPackage,
} from "./artifacts.ts"

import type { QualityTask } from "./plan.ts"
import type { Context } from "../core/context.ts"

/**
 * 一项任务的最终结果。
 */
export interface QualityTaskResult {
  /**
   * 稳定任务标识。
   */
  readonly id: string
  /**
   * 成功、失败、被前置阻断或未配置。
   */
  readonly status: "passed" | "failed" | "blocked" | "skipped"
  /**
   * 原始退出码。
   */
  readonly code: number
  /**
   * 未执行原因。
   */
  readonly reason?: string
}

/**
 * 一次检查的汇总。
 */
export interface QualityResult {
  /**
   * 首个失败码；中断固定为 130。
   */
  readonly code: number
  /**
   * 按完成顺序记录的任务结果。
   */
  readonly tasks: readonly QualityTaskResult[]
}

/**
 * 执行器选项，命令边界可由测试替换。
 */
export interface QualityRunOptions {
  /**
   * 失败后继续不受影响的任务。
   */
  readonly keepGoing?: boolean
  /**
   * 测试专用执行边界，传入时不启动子进程。
   */
  readonly execute?: (task: QualityTask) => Promise<number>
}

/**
 * 执行一项命令或内置校验。
 * @param context - 终端和仓库环境。
 * @param task - 已规划的任务。
 */
async function executeTask(context: Context, task: QualityTask): Promise<number> {
  const { terminal, root, env, parentId } = context

  if (task.args) {
    return await runWorkflowCommand({
      terminal,
      parentId,
      title: task.title,
      target: task.directory,
      command: "pnpm",
      args: task.args,
      cwd: root,
      env,
    })
  }

  return await runWorkflowTask({
    terminal,
    parentId,
    title: task.title,
    target: task.directory,
    execute: async () => {
      if (task.error) {
        throw new Error(task.error)
      }

      if (task.check === "config") {
        await checkQualityConfig(root, task.directory)
      }

      if (task.check === "artifacts") {
        await checkQualityArtifacts(
          context,
          task.directory,
          async (directory) => await previewQualityPackage(context, directory)
        )
      }
    },
  })
}

/**
 * 按任务图执行并阻断失败前置的消费者；一次调用内去重。
 * @param context - 终端及仓库上下文。
 * @param plan - 任务定义，允许前置任务排在后面。
 * @param options - 继续策略与测试执行边界。
 * @example const result = await runQualityPlan(context, plan, { keepGoing: true })
 */
export async function runQualityPlan(
  context: Context,
  plan: readonly QualityTask[],
  options: QualityRunOptions = {}
): Promise<QualityResult> {
  // 用于解析任务前置的索引。
  const byId = new Map(plan.map((task) => [task.id, task]))

  if (byId.size !== plan.length) {
    throw new Error("质量任务标识重复")
  }

  // 在启动任何命令前校验整张图，避免无关任务先执行后才发现配置环。
  const validated = new Set<string>()

  const path = new Set<string>()

  /**
   * @param task - 正在验证前置关系的任务。
   */
  const validate = (task: QualityTask): void => {
    if (validated.has(task.id)) {
      return
    }

    if (path.has(task.id)) {
      throw new Error(`质量任务循环：${task.id}`)
    }

    path.add(task.id)
    for (const id of task.needs) {
      const dependency = byId.get(id)

      if (!dependency) {
        throw new Error(`缺少前置质量任务：${id}`)
      }

      validate(dependency)
    }

    path.delete(task.id)
    validated.add(task.id)
  }

  for (const task of plan) {
    validate(task)
  }

  // 本次调用内已经完成的任务及结果。
  const results = new Map<string, QualityTaskResult>()

  // 当前递归路径，用于报告循环。
  const visiting = new Set<string>()

  // 首个失败退出码，中断优先。
  let code = 0

  /**
   * @param task - 当前任务，先完成其尚未执行的前置。
   */
  const visit = async (task: QualityTask): Promise<void> => {
    if (results.has(task.id)) {
      return
    }

    if (visiting.has(task.id)) {
      throw new Error(`质量任务循环：${task.id}`)
    }

    visiting.add(task.id)
    for (const id of task.needs) {
      // 当前需要准备的本地依赖。
      const dependency = byId.get(id)

      if (!dependency) {
        throw new Error(`缺少前置质量任务：${id}`)
      }

      await visit(dependency)
    }

    visiting.delete(task.id)
    // 尚未成功的前置任务。
    const failed = task.needs.filter((id) => results.get(id)?.status !== "passed")

    if (failed.length > 0 || code === 130 || (code !== 0 && !options.keepGoing)) {
      results.set(task.id, {
        id: task.id,
        status: "blocked",
        code: 1,
        reason: failed.length > 0 ? `前置失败：${failed.join(", ")}` : "流程已停止",
      })

      return
    }

    if (task.skip) {
      results.set(task.id, { id: task.id, status: "skipped", code: 0, reason: task.skip })

      return
    }

    // 当前任务的真实退出码。
    const taskCode = options.execute
      ? await options.execute(task)
      : await executeTask(context, task)

    results.set(task.id, {
      id: task.id,
      status: taskCode === 0 ? "passed" : "failed",
      code: taskCode,
    })
    if (taskCode === 130) {
      code = 130
    } else {
      code ||= taskCode
    }
  }

  for (const task of plan) {
    await visit(task)
  }

  // 按执行顺序保留的任务或结果。
  const tasks = [...results.values()]

  context.terminal.summary({
    title: "质量检查结果",
    tone: code === 0 ? "success" : "error",
    parentId: context.parentId,
    content: tasks
      .map(
        (task) => `${task.status} · ${task.id}${task.reason ? ` · ${task.reason}` : ""}`
      )
      .join("\n"),
  })

  return { code, tasks }
}
