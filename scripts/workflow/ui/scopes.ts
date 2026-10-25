// 范围反馈、计时与取消收尾；记录由独立状态模块持有。
import {
  UI_DURATION,
  UI_ICON,
  UI_LAYOUT,
  UI_RAIL,
  UI_SEPARATOR,
  UI_TASK_TEXT,
} from "./config.ts"
import { UI_OUTCOME_ROLE } from "./theme.ts"

import type { HeadingOptions, Messages, TerminalMessages } from "./messages.ts"
import type { Renderer } from "./renderer.ts"
import type { FlowId, GroupId, ParentId, ScopeState, TaskId } from "./scope-state.ts"
import type { Formatter } from "./theme.ts"

/**
 * 流程结束状态。
 */
export type Outcome = "success" | "failed" | "cancelled"

/**
 * 流程标题；domain 仅为可选展示标签。
 */
export interface StartFlowOptions {
  /**
   * 流程名称，不承担业务路由或识别职责。
   */
  readonly title: string
  /**
   * 可选展示标签，与标题以间隔符连接。
   */
  readonly domain?: string
  /**
   * 可选流程说明，使用正文缩进。
   */
  readonly description?: string
}

/**
 * 按流程标识输出最终结果并收尾未完成的子范围。
 */
export interface EndFlowOptions {
  /**
   * 由当前终端创建的流程标识。
   */
  readonly flowId: FlowId
  /**
   * 消费端确定的最终结果。
   */
  readonly outcome: Outcome
  /**
   * 最终结果文案，随结束标记显示。
   */
  readonly message: string
}

/**
 * 建立逻辑分组，显示缩进不随分组深度增加。
 */
export interface StartGroupOptions extends HeadingOptions {
  /**
   * 可选阶段说明，使用正文缩进。
   */
  readonly description?: string
}

/**
 * 结束分组并收尾未完成的子范围，不结束所属流程。
 */
export interface EndGroupOptions {
  /**
   * 由当前终端创建的分组标识。
   */
  readonly groupId: GroupId
  /**
   * 消费端确定的分组结果。
   */
  readonly outcome: Outcome
  /**
   * 分组结束文案，不推断任务的业务结果。
   */
  readonly message: string
}

/**
 * 只建立任务反馈和计时，不启动业务操作。
 */
export interface StartTaskOptions extends HeadingOptions {
  /**
   * 可选展示目标，如包名；不解析其格式。
   */
  readonly target?: string | undefined
}

/**
 * 按任务标识记录成功，可附加结果说明。
 */
export interface SucceedTaskOptions {
  /**
   * 由当前终端创建的任务标识。
   */
  readonly taskId: TaskId
  /**
   * 可选的结束说明；耗时由终端自动补充。
   */
  readonly message?: string | undefined
}

/**
 * 记录任务失败，可显示异常载荷；该操作本身不抛出载荷。
 */
export interface FailTaskOptions extends SucceedTaskOptions {
  /**
   * 可选异常载荷，只用于显示，不改变调用方控制流。
   */
  readonly error?: unknown
}

/**
 * 记录任务取消，不中断消费端自行启动的操作。
 */
export interface CancelTaskOptions {
  /**
   * 由当前终端创建的任务标识。
   */
  readonly taskId: TaskId
  /**
   * 可选取消原因，附加到结束标记。
   */
  readonly reason?: string | undefined
}

/**
 * 直接显示跳过原因，不建立运行中的任务记录。
 */
export interface SkipTaskOptions extends StartTaskOptions {
  /**
   * 任务没有启动的可读原因。
   */
  readonly reason: string
}

/**
 * 显示未执行项，不将其加入执行队列。
 */
export interface PendingTaskOptions {
  /**
   * 尚未执行的目标名称。
   */
  readonly target: string
  /**
   * 可选任务名称，省略时只显示目标和原因。
   */
  readonly title?: string
  /**
   * 任务未执行的可读原因。
   */
  readonly reason: string
  /**
   * 未执行项关联的可选父范围。
   */
  readonly parentId?: ParentId | undefined
}

/**
 * 公开流程、分组和任务反馈能力。
 */
export interface TerminalScopes {
  /**
   * 创建流程并返回本实例生成的 FlowId。
   * @param options - 流程标题及可选标签、说明。
   * @example const flowId = terminal.startFlow({ title: "构建" })
   */
  startFlow(this: void, options: StartFlowOptions): FlowId
  /**
   * 按标识结束流程并收尾子范围，重复结束不重复输出。
   * @param options - 当前实例的流程标识、结果和结束文案。
   * @example terminal.endFlow({ flowId, outcome: "success", message: "构建完成。" })
   */
  endFlow(this: void, options: EndFlowOptions): void
  /**
   * 创建分组，视觉缩进不随逻辑嵌套继续增加。
   * @param options - 分组标题、说明及可选父范围。
   * @example const groupId = terminal.startGroup({ title: "质量检查", parentId: flowId })
   */
  startGroup(this: void, options: StartGroupOptions): GroupId
  /**
   * 按标识结束分组，重复结束不重复输出。
   * @param options - 当前实例的分组标识、结果和结束文案。
   * @example terminal.endGroup({ groupId, outcome: "success", message: "检查通过。" })
   */
  endGroup(this: void, options: EndGroupOptions): void
  /**
   * 只开始任务反馈并返回 TaskId，不执行任何业务操作。
   * @param options - 任务名称、展示目标及可选父范围。
   * @example const taskId = terminal.startTask({ title: "生成产物", parentId: groupId })
   */
  startTask(this: void, options: StartTaskOptions): TaskId
  /**
   * 记录任务成功和耗时，重复收尾不重复输出。
   * @param options - 当前实例的任务标识及可选结束说明。
   * @example terminal.succeedTask({ taskId, message: "产物已生成。" })
   */
  succeedTask(this: void, options: SucceedTaskOptions): void
  /**
   * 记录错误和任务失败，不抛出传入的异常。
   * @param options - 任务标识、可选异常载荷和结束说明。
   * @example terminal.failTask({ taskId, error: new Error("构建失败") })
   */
  failTask(this: void, options: FailTaskOptions): void
  /**
   * 记录取消，不强制中断消费端自己的异步操作。
   * @param options - 任务标识及可选取消原因。
   * @example terminal.cancelTask({ taskId, reason: "用户取消" })
   */
  cancelTask(this: void, options: CancelTaskOptions): void
  /**
   * 展示跳过项，不启动任务。
   * @param options - 未启动任务的名称、目标、原因及可选父范围。
   * @example terminal.skipTask({ title: "构建", target: "core", reason: "没有构建脚本" })
   */
  skipTask(this: void, options: SkipTaskOptions): void
  /**
   * 展示未执行项，不加入调度队列。
   * @param options - 未执行目标、原因及可选任务名称和父范围。
   * @example terminal.pendingTask({ target: "vue", reason: "前一目标失败" })
   */
  pendingTask(this: void, options: PendingTaskOptions): void
}

/**
 * 以紧凑格式显示耗时。
 * @param milliseconds - 耗时毫秒数。
 * @example formatDuration(1200)
 */
function formatDuration(milliseconds: number): string {
  return milliseconds < 1000
    ? `${Math.max(0, Math.round(milliseconds))}${UI_DURATION.MILLISECONDS_UNIT}`
    : `${(milliseconds / 1000).toFixed(UI_DURATION.SECONDS_FRACTION_DIGITS)}${UI_DURATION.SECONDS_UNIT}`
}

// 范围模块只查询会话状态，不拥有实例或进程级状态。
interface ScopesOptions {
  // 实例语义色格式化。
  readonly format: Formatter
  // 主线、缩进和日志区域的共同渲染器。
  readonly renderer: Renderer
  // 标识、父级和结束状态的唯一所有者。
  readonly state: ScopeState
  // 收尾前检查实例尚未释放。
  readonly check: () => void
  // 说明文字使用共享的正文输出规则。
  readonly text: TerminalMessages["text"]
  // 异常载荷复用消息模块的错误展示。
  readonly reportError: Messages["reportError"]
  // 读取实例是否已被系统信号取消。
  readonly isCancelled: () => boolean
  // 清理期间普通结束请求需要延后。
  readonly isHandlingSignal: () => boolean
  // 外部清理完毕后才允许写最终结束标记。
  readonly isFinalizing: () => boolean
}

/**
 * 公开范围反馈及实例内部的取消收尾操作。
 */
export interface Scopes extends TerminalScopes {
  /**
   * 清理后统一收尾活动范围，无活动时补充独立取消提示。
   */
  finishSignal(this: void): void
  /**
   * 丢弃延迟结束请求，不修改或清空其他模块持有的状态。
   */
  dispose(this: void): void
}

/**
 * 创建范围反馈，范围记录由单独的状态模块提供。
 * @param environment - 本实例展示、登记和会话查询能力。
 * @example const scopes = createScopes({ format, renderer, state, check, text, reportError, isCancelled, isHandlingSignal, isFinalizing })
 */
export function createScopes(environment: ScopesOptions): Scopes {
  // 只注入本模块使用的展示操作和只读实例状态查询。
  const { format, renderer, check, text, reportError, state } = environment

  // 父级及标识验证由唯一范围状态所有者提供。
  const { requireScope, checkParent } = state

  // 清理阶段结束请求延后到最终反馈阶段，保持消费端顺序。
  const deferredEnds: (() => void)[] = []

  /**
   * 为范围结束选择固定结果符号。
   * @param outcome - 消费端确定的结束结果。
   */
  const symbol = (outcome: Outcome): string =>
    ({ success: UI_ICON.SUCCESS, failed: UI_ICON.ERROR, cancelled: UI_ICON.CANCELLED })[
      outcome
    ]

  // 流程起点根据既有主线选择新起点或分支连接符。
  const startFlow: TerminalScopes["startFlow"] = (options) => {
    // 登记模块负责校验、标识生成和开始时间戳。
    const id = state.register({ kind: "flow", title: options.title })

    renderer.space(UI_LAYOUT.STAGE_GAP_LINES)
    // 展示标签和标题独立上色，未提供标签时不保留多余分隔符。
    const title = [
      options.domain === undefined ? undefined : format(options.domain, "accent"),
      format(options.title, "heading"),
    ]
      .filter(
        /**
         * 省略未提供的展示标签，保留其他内容。
         * @param part - 等待拼接的原始展示片段。
         */
        (part) => part !== undefined
      )
      .join(UI_SEPARATOR.PART)

    renderer.write({
      content: title,
      edge: renderer.connected ? UI_RAIL.BRANCH : UI_RAIL.START,
    })
    if (options.description) {
      text({ content: options.description, parentId: id })
    }

    renderer.space(UI_LAYOUT.TASK_GAP_LINES)

    return id
  }

  // 记录逻辑层级，视觉上仍使用固定的基础缩进。
  const startGroup: TerminalScopes["startGroup"] = (options) => {
    // 登记模块负责校验、标识生成和开始时间戳。
    const id = state.register({
      kind: "group",
      title: options.title,
      parentId: options.parentId,
    })

    renderer.space(UI_LAYOUT.STAGE_GAP_LINES)
    renderer.write({
      content: `${format(UI_ICON.GROUP, "accent")} ${format(options.title, "heading")}`,
    })
    if (options.description) {
      text({ content: options.description, parentId: id })
    }

    renderer.space(UI_LAYOUT.TASK_GAP_LINES)

    return id
  }

  // 最近开始且未结束的任务拥有动画，子任务结束后自动恢复父任务。
  const refreshLoading = (): void => {
    const active = state
      .snapshot()
      .findLast((record) => record.kind === "task" && !record.ended)

    if (!active || environment.isCancelled()) {
      renderer.setLoading()

      return
    }

    renderer.setLoading(
      [active.target, active.title]
        .filter((part) => part !== undefined && part !== "")
        .join(UI_SEPARATOR.PART)
    )
  }

  // 只登记反馈和计时，执行操作由消费端或组合方法负责。
  const startTask: TerminalScopes["startTask"] = (options) => {
    // 登记模块负责校验、标识生成和开始时间戳。
    const id = state.register({
      kind: "task",
      title: options.title,
      parentId: options.parentId,
      target: options.target,
    })

    renderer.space(UI_LAYOUT.TASK_GAP_LINES)
    renderer.write({
      content: [
        format(`${UI_ICON.STARTED} ${UI_TASK_TEXT.STARTED}`, "accent"),
        options.target === undefined ? undefined : format(options.target, "target"),
        format(options.title, "command"),
      ]
        .filter(
          /**
           * 省略缺省和空的展示片段，避免多余分隔符。
           * @param part - 等待拼接的原始展示片段。
           */
          (part) => part !== undefined && part !== ""
        )
        .join(UI_SEPARATOR.PART),
    })

    refreshLoading()

    return id
  }

  /**
   * 统一记录任务结果与耗时，重复结束或清理期间的结束请求直接忽略。
   * @param taskId - 当前实例的任务标识。
   * @param outcome - 预期结果，实例已取消时统一显示取消。
   * @param message - 可选的结果补充说明。
   */
  const finishTask = (taskId: TaskId, outcome: Outcome, message?: string): void => {
    check()
    // 校验标识后访问当前实例的范围记录。
    const record = requireScope(taskId, "task")

    if (record.ended || (environment.isHandlingSignal() && !environment.isFinalizing())) {
      return
    }

    state.end(taskId)
    refreshLoading()
    // 实例取消优先于正在返回的成功或失败结果。
    const result = environment.isCancelled() ? "cancelled" : outcome

    // 结果标记同时包含符号和文字，颜色不可用时仍能辨识。
    const marker = {
      success: `${UI_ICON.SUCCESS} ${UI_TASK_TEXT.SUCCESS}`,
      failed: `${UI_ICON.ERROR} ${UI_TASK_TEXT.FAILED}`,
      cancelled: `${UI_ICON.CANCELLED} ${UI_TASK_TEXT.CANCELLED}`,
    }[result]

    renderer.write({
      content: [
        format(marker, UI_OUTCOME_ROLE[result]),
        record.target === undefined ? undefined : format(record.target, "target"),
        format(record.title, "command"),
        format(formatDuration(Date.now() - record.started), "value"),
        message,
      ]
        .filter(
          /**
           * 省略缺省和空的展示片段，避免多余分隔符。
           * @param part - 等待拼接的原始展示片段。
           */
          (part) => part !== undefined && part !== ""
        )
        .join(UI_SEPARATOR.PART),
    })
    renderer.space(UI_LAYOUT.TASK_GAP_LINES)
  }

  // 成功反馈与其他结束方式共用计时和幂等处理。
  const succeedTask: TerminalScopes["succeedTask"] = ({ taskId, message }) =>
    finishTask(taskId, "success", message)

  // 在任务尚可结束时先显示异常，再输出一次失败标记。
  const failTask: TerminalScopes["failTask"] = ({ taskId, message, error: failure }) => {
    check()
    // 校验标识后访问当前实例的范围记录。
    const record = requireScope(taskId, "task")

    if (record.ended || (environment.isHandlingSignal() && !environment.isFinalizing())) {
      return
    }

    if (failure !== undefined) {
      reportError(failure)
    }

    finishTask(taskId, "failed", message)
  }

  // 仅更新展示，不负责终止消费端自己的异步操作。
  const cancelTask: TerminalScopes["cancelTask"] = ({ taskId, reason }) =>
    finishTask(taskId, "cancelled", reason)

  /**
   * 收尾父范围的未完成后代，查询顺序由登记模块保证。
   * @param parentId - 需要关闭的祖先范围。
   */
  const closeDescendants = (parentId: ParentId): void => {
    // 查询返回列表副本，结束后代不会改变遍历顺序。
    for (const record of state.descendants(parentId)) {
      if (record.ended) {
        continue
      }

      if (record.kind === "task" && record.id.startsWith("task:")) {
        // 种类和前缀均已验证，Map 记录的键无法由 TypeScript 联合收窄。
        cancelTask({ taskId: record.id as TaskId })
      } else {
        state.end(record.id)
      }
    }
  }

  // 流程结束使用底部连接符，信号清理期间先缓存结束请求。
  const endFlow: TerminalScopes["endFlow"] = (options) => {
    check()
    // 校验标识后访问当前实例的范围记录。
    const record = requireScope(options.flowId, "flow")

    if (record.ended) {
      return
    }

    if (environment.isHandlingSignal() && !environment.isFinalizing()) {
      deferredEnds.push(() => endFlow(options))

      return
    }

    closeDescendants(options.flowId)
    state.end(options.flowId)
    renderer.space(UI_LAYOUT.STAGE_GAP_LINES)
    renderer.write({
      content: `${format(symbol(options.outcome), UI_OUTCOME_ROLE[options.outcome])} ${format(options.message, UI_OUTCOME_ROLE[options.outcome])}`,
      edge: UI_RAIL.END,
    })
  }

  // 分组结束保留主线，后续阶段可以继续沿同列输出。
  const endGroup: TerminalScopes["endGroup"] = (options) => {
    check()
    // 校验标识后访问当前实例的范围记录。
    const record = requireScope(options.groupId, "group")

    if (record.ended) {
      return
    }

    if (environment.isHandlingSignal() && !environment.isFinalizing()) {
      deferredEnds.push(() => endGroup(options))

      return
    }

    closeDescendants(options.groupId)
    state.end(options.groupId)
    renderer.write({
      content: `${format(symbol(options.outcome), UI_OUTCOME_ROLE[options.outcome])} ${format(options.message, UI_OUTCOME_ROLE[options.outcome])}`,
    })
    renderer.space(UI_LAYOUT.STAGE_GAP_LINES)
  }

  /**
   * 跳过和未执行共用布局，使用各自的语义图标。
   * @param options - 目标、标题、原因和父范围。
   * @param icon - 本次反馈的语义标记。
   */
  const writeSkippedTask = (options: SkipTaskOptions, icon: string): void => {
    checkParent(options.parentId)
    renderer.space(UI_LAYOUT.TASK_GAP_LINES)
    renderer.write({
      content: [
        format(icon, "muted"),
        options.target === undefined ? undefined : format(options.target, "target"),
        format(options.title, "command"),
        format(options.reason, "muted"),
      ]
        .filter(
          /**
           * 省略缺省和空的展示片段，避免多余分隔符。
           * @param part - 等待拼接的原始展示片段。
           */
          (part) => part !== undefined && part !== ""
        )
        .join(UI_SEPARATOR.PART),
    })
    renderer.space(UI_LAYOUT.TASK_GAP_LINES)
  }

  // 跳过项不创建需要结束的任务记录。
  const skipTask: TerminalScopes["skipTask"] = (options) =>
    writeSkippedTask(options, UI_ICON.SKIPPED)

  // 未执行项使用独立图标，省略标题时不增加空分隔符。
  const pendingTask: TerminalScopes["pendingTask"] = (options) =>
    writeSkippedTask({ ...options, title: options.title ?? "" }, UI_ICON.PENDING)

  // 先取消运行中任务，再完成消费端延后的范围结束。
  const finishSignal = (): void => {
    // 只把未结束任务或流程视为需要额外收尾的运行状态。
    const hadActivity = state.snapshot().some(
      /**
       * 只统计仍需信号收尾的任务或流程。
       * @param record - 当前实例的范围记录。
       */
      (record) => !record.ended && (record.kind === "task" || record.kind === "flow")
    )

    // 范围按登记顺序遍历，保留既有反馈顺序。
    for (const record of state.snapshot()) {
      // 标识只从登记模块的记录中取得。
      const id = record.id

      if (record.kind === "task" && !record.ended && id.startsWith("task:")) {
        // Map 的键和记录不能联合收窄；种类和键前缀已在分支中验证。
        cancelTask({ taskId: id as TaskId })
      }
    }

    // 延后回调保持消费端发起结束请求的顺序。
    for (const finish of deferredEnds) {
      finish()
    }

    // 范围按登记顺序遍历，保留既有反馈顺序。
    for (const record of state.snapshot()) {
      // 标识只从登记模块的记录中取得。
      const id = record.id

      if (record.kind === "flow" && !record.ended && id.startsWith("flow:")) {
        // 同时验证种类和前缀后，键才可作为流程标识传回。
        endFlow({
          flowId: id as FlowId,
          outcome: "cancelled",
          message: `${record.title}已取消。`,
        })
      }
    }

    if (!hadActivity) {
      renderer.write({
        content: format(
          `${UI_ICON.CANCELLED} ${UI_TASK_TEXT.CANCELLED}`,
          UI_OUTCOME_ROLE.cancelled
        ),
        edge: UI_RAIL.END,
      })
    }
  }

  // 只释放本模块的延迟结束请求，范围记录由登记模块释放。
  const dispose = (): void => {
    renderer.setLoading()
    deferredEnds.length = 0
  }

  return {
    startFlow,
    endFlow,
    startGroup,
    endGroup,
    startTask,
    succeedTask,
    failTask,
    cancelTask,
    skipTask,
    pendingTask,
    finishSignal,
    dispose,
  }
}
