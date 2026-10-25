/**
 * 批处理业务编排。目标循环、首错停止、继续执行和取消策略由工作流管理，
 * 终端只接收显式分组标识及反馈操作。
 */
import { CANCELLED_EXIT_CODE } from "./core/errors.ts"
import { WORKFLOW_TEXT } from "./display-config.ts"
import { formatWorkflowText } from "./presentation.ts"
import { endWorkflowFlow } from "./presentation.ts"

import type { GroupId, Terminal } from "./ui/index.ts"

/** 批处理选项。 */
export interface BatchOptions<T> {
  /** 任务标签。 */
  readonly label: string
  readonly groupId?: GroupId
  /** 待执行项。 */
  readonly items: readonly T[]
  /** 是否在普通失败后继续执行剩余项。 */
  readonly keepGoing: boolean
  /** 为一项生成可读的失败标识。 */
  readonly identify: (item: T) => string
  /** 任务名称，作为中间列。 */
  readonly taskLabel: string
  /** 执行一项，返回退出码。 */
  readonly execute: (
    item: T,
    index: number,
    total: number,
    parentId: GroupId
  ) => Promise<number>
}

/** 批处理结果。 */
export interface BatchResult {
  /** 退出码：0 成功、130 取消、其余为首个失败码。 */
  readonly exitCode: number
  /** 是否为取消。 */
  readonly cancelled: boolean
}

/**
 * 顺序执行一批目标并统一汇总失败。
 *
 * @param terminal - 终端实例。
 * @param options - 批处理选项。
 * @returns 批处理结果。
 */
export async function runBatch<T>(
  terminal: Terminal,
  options: BatchOptions<T>
): Promise<BatchResult> {
  const { label, items, keepGoing, identify, execute } = options

  const total = items.length

  if (total === 0) {
    return { exitCode: 0, cancelled: false }
  }

  const groupId =
    options.groupId ??
    terminal.startGroup({ title: `${WORKFLOW_TEXT.EXECUTE_PREFIX}${label}` })

  const failures: string[] = []

  const unexecuted: string[] = []

  let firstFailure = 0

  for (const [index, item] of items.entries()) {
    const exitCode = await execute(item, index + 1, total, groupId)

    const target = identify(item)

    if (exitCode === 0) {
      continue
    }

    if (exitCode === CANCELLED_EXIT_CODE) {
      markRemaining(terminal, items, identify, index + 1, unexecuted, total)
      terminal.endGroup({
        groupId: groupId,
        outcome: "cancelled",
        message: `${label}已取消：${target}。`,
      })

      return { exitCode: CANCELLED_EXIT_CODE, cancelled: true }
    }

    failures.push(target)
    firstFailure ||= exitCode

    if (!keepGoing) {
      markRemaining(terminal, items, identify, index + 1, unexecuted, total)
      // 失败项与未执行项已经逐行列出，再弹一张摘要卡片只是重复同一批信息。
      terminal.endGroup({
        groupId: groupId,
        outcome: "failed",
        message: `${label}失败：${target}。${unexecuted.length > 0 ? `另有 ${unexecuted.length} 个目标未执行。` : ""}`,
      })

      return { exitCode, cancelled: false }
    }
  }

  if (firstFailure !== 0) {
    terminal.endGroup({
      groupId: groupId,
      outcome: "failed",
      message: `${label}未全部完成：${failures.length} 个目标未通过。`,
    })

    return { exitCode: firstFailure, cancelled: false }
  }

  terminal.endGroup({
    groupId: groupId,
    outcome: "success",
    message: `${label}完成：共执行 ${total} 个目标。`,
  })

  return { exitCode: 0, cancelled: false }
}

/** 批处理流程的文案与结构。 */
export interface BatchFlowOptions<T> extends Omit<BatchOptions<T>, "label"> {
  /** 流程标题，同时用作成功、失败、取消三种结束文案的词根。 */
  readonly label: string
  /** 流程说明。 */
  readonly description?: string
}

/**
 * 开启一次批处理流程并跑完，把 flow 与 group 的开闭也收敛到一处。
 *
 * @remarks `build`、workspace 质量任务与 `release pack` 此前各自重复着同一套
 * 「startFlow → startGroup → batch → endWorkflowFlow」骨架与三条结束文案。
 * 收进这里后，命令侧只剩「挑选目标」一件事。
 *
 * @param terminal - 终端实例。
 * @param options - 流程选项。
 * @returns 退出码。
 */
export async function runBatchFlow<T>(
  terminal: Terminal,
  options: BatchFlowOptions<T>
): Promise<number> {
  const { label } = options

  const flowId1 = terminal.startFlow({
    domain: "workspace",
    title: label,
    description: formatWorkflowText({
      terminal,
      content: options.description ?? WORKFLOW_TEXT.DEFAULT_FLOW_DESCRIPTION,
    }),
  })

  const groupId1 = terminal.startGroup({
    title: `${WORKFLOW_TEXT.EXECUTE_PREFIX}${label}`,
    description: formatWorkflowText({
      terminal,
      content: WORKFLOW_TEXT.DEFAULT_GROUP_DESCRIPTION,
    }),
    parentId: flowId1,
  })

  const result = await runBatch(terminal, { ...options, label, groupId: groupId1 })

  endWorkflowFlow({
    terminal: terminal,
    flowId: flowId1,
    exitCode: result.exitCode,
    messages: {
      success: `${label}完成。`,
      failed: `${label}未全部完成。`,
      cancelled: `${label}已取消。`,
    },
  })

  return result.exitCode
}

/**
 * 把未执行的目标显式列为待办。
 *
 * @remarks 原文案只在失败时用一句「未执行：N 个目标」概括，看不出是哪些；
 * 逐行列出后，失败点的位置与影响范围一眼可见。
 *
 * @param terminal - 终端实例。
 * @param items - 全部目标。
 * @param identify - 目标标识函数。
 * @param fromIndex - 从第几项开始未执行。
 * @param sink - 已记录的目标。
 * @param total - 总数。
 */
function markRemaining<T>(
  terminal: Terminal,
  items: readonly T[],
  identify: (item: T) => string,
  fromIndex: number,
  sink: string[],
  _total: number
): void {
  for (let index = fromIndex; index < items.length; index += 1) {
    const item = items[index]

    if (item === undefined) {
      continue
    }

    const target = identify(item)

    sink.push(target)
    terminal.pendingTask({ target: target, title: "", reason: WORKFLOW_TEXT.PENDING })
  }
}
