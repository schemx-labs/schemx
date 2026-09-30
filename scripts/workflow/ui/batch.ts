/**
 * 批处理执行器。
 *
 * @remarks 保留原 `shared/batch-runner.sh` 的语义：统一目标循环、失败收集、
 * `--keep-going` 与「取消永远立即停止」规则。
 *
 * 相对上一版的变化：批处理负责设置三列布局、把未执行目标显式列出，并把原先分散在
 * 各命令里的收尾文案收敛为一套「结束矩阵」，避免同一批文案在十余处重复书写。
 */
import { CANCELLED_EXIT_CODE } from "../core/errors.ts"

import { computeColumns } from "./layout.ts"
import { type Ui } from "./ui.ts"

/** 批处理选项。 */
export interface BatchOptions<T> {
  /** 任务标签。 */
  readonly label: string
  /** 待执行项。 */
  readonly items: readonly T[]
  /** 是否在普通失败后继续执行剩余项。 */
  readonly keepGoing: boolean
  /** 为一项生成可读的失败标识。 */
  readonly identify: (item: T) => string
  /** 任务名称，作为中间列。 */
  readonly taskLabel: string
  /** 执行一项，返回退出码。 */
  readonly execute: (item: T, index: number, total: number) => Promise<number>
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
 * @param ui - 终端 UI。
 * @param options - 批处理选项。
 * @returns 批处理结果。
 */
export async function runBatch<T>(
  ui: Ui,
  options: BatchOptions<T>
): Promise<BatchResult> {
  const { label, items, keepGoing, identify, execute } = options

  const total = items.length

  if (total === 0) {
    return { exitCode: 0, cancelled: false }
  }

  // 列宽只依赖本批次的实际内容，跨批次互不干扰。
  ui.columns = computeColumns(items.map(identify), [options.taskLabel])

  const failures: string[] = []

  const unexecuted: string[] = []

  let firstFailure = 0

  for (const [index, item] of items.entries()) {
    const exitCode = await execute(item, index + 1, total)

    const target = identify(item)

    if (exitCode === 0) {
      continue
    }

    if (exitCode === CANCELLED_EXIT_CODE) {
      markRemaining(ui, items, identify, index + 1, unexecuted, total)
      ui.groupEnd("cancelled", `${label}已取消：${target}。`)

      return { exitCode: CANCELLED_EXIT_CODE, cancelled: true }
    }

    failures.push(target)
    firstFailure ||= exitCode

    if (!keepGoing) {
      markRemaining(ui, items, identify, index + 1, unexecuted, total)
      // 失败项与未执行项已经逐行列出，再弹一张摘要卡片只是重复同一批信息。
      ui.groupEnd(
        "failed",
        `${label}失败：${target}。${unexecuted.length > 0 ? `另有 ${unexecuted.length} 个目标未执行。` : ""}`
      )

      return { exitCode, cancelled: false }
    }
  }

  if (firstFailure !== 0) {
    ui.groupEnd("failed", `${label}未全部完成：${failures.length} 个目标未通过。`)

    return { exitCode: firstFailure, cancelled: false }
  }

  ui.groupEnd("success", `${label}完成：共执行 ${total} 个目标。`)

  return { exitCode: 0, cancelled: false }
}

/** 批处理流程的文案与结构。 */
export interface BatchFlowOptions<T> extends Omit<BatchOptions<T>, "label"> {
  /** 流程标题，同时用作成功、失败、取消三种结束文案的词根。 */
  readonly label: string
  /** 流程说明。 */
  readonly description?: string
}

/** 批处理流程的默认说明。 */
/** 分组说明：解释 `--keep-going` 的语义，与流程说明区分开。 */
const GROUP_DESCRIPTION = "按选中目标顺序执行；--keep-going 会在普通失败后继续。"

/** 流程说明：描述整体行为。 */
const FLOW_DESCRIPTION = "逐个执行选中目标的同名 script。"

/**
 * 开启一次批处理流程并跑完，把 flow 与 group 的开闭也收敛到一处。
 *
 * @remarks `build`、workspace 质量任务与 `release pack` 此前各自重复着同一套
 * 「flowBegin → note → groupBegin → batch → flowEndFromExitCode」骨架与三条结束文案。
 * 收进这里后，命令侧只剩「挑选目标」一件事。
 *
 * @param ui - 终端 UI。
 * @param options - 流程选项。
 * @returns 退出码。
 */
export async function runBatchFlow<T>(
  ui: Ui,
  options: BatchFlowOptions<T>
): Promise<number> {
  const { label } = options

  ui.flowBegin({
    domain: "workspace",
    title: label,
    description: options.description ?? FLOW_DESCRIPTION,
  })
  ui.groupBegin({ title: `执行${label}`, description: GROUP_DESCRIPTION })

  const result = await runBatch(ui, { ...options, label })

  ui.flowEndFromExitCode(result.exitCode, {
    success: `${label}完成。`,
    failed: `${label}未全部完成。`,
    cancelled: `${label}已取消。`,
  })

  return result.exitCode
}

/**
 * 把未执行的目标显式列为待办。
 *
 * @remarks 原文案只在失败时用一句「未执行：N 个目标」概括，看不出是哪些；
 * 逐行列出后，失败点的位置与影响范围一眼可见。
 *
 * @param ui - 终端 UI。
 * @param items - 全部目标。
 * @param identify - 目标标识函数。
 * @param fromIndex - 从第几项开始未执行。
 * @param sink - 已记录的目标。
 * @param total - 总数。
 */
function markRemaining<T>(
  ui: Ui,
  items: readonly T[],
  identify: (item: T) => string,
  fromIndex: number,
  sink: string[],
  total: number
): void {
  for (let index = fromIndex; index < items.length; index += 1) {
    const item = items[index]

    if (item === undefined) {
      continue
    }

    const target = identify(item)

    sink.push(target)
    ui.taskPending(target, "", "未执行", index === total - 1)
  }
}
