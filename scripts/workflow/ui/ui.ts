/**
 * 终端 UI。
 *
 * @remarks 对外契约保持不变：视觉输出全部写 stderr，stdout 只留给机器可读结果。
 *
 * @remarks 流程、分组、任务与摘要共用左侧导轨。阶段之间留白，颜色区分阶段与结果。
 * 捕获与实时模式共用底部任务动画，日志追加时先让出动画行再恢复。
 */
import { Writable } from "node:stream"

import { box } from "@clack/prompts"

import { CANCELLED_EXIT_CODE } from "../core/errors.ts"
import { run, type RunOptions, type RunResult } from "../core/exec.ts"

import {
  type ColumnLayout,
  formatDetail,
  formatGroupNote,
  formatGroupTitle,
  formatTaskRow,
  railPrefix,
  type TaskRow,
} from "./layout.ts"
import {
  classifyDetailLine,
  type DetailTone,
  type Result,
  setColorSupport,
  SPINNER_FRAMES,
  SPINNER_INTERVAL_MS,
  theme,
  visibleWidth,
  wrapText,
} from "./theme.ts"

/** 反馈语气。 */
export type Tone = "neutral" | "info" | "success" | "warning" | "error"

/** 流程终止语气。 */
export type Outcome = "success" | "failed" | "cancelled"

/** 子进程输出模式。 */
export type LogMode = "live" | "capture"

/** 任务展示选项。 */
export interface TaskOptions {
  /** 任务名称。 */
  title: string
  /** 关联目标；提供时会在三列布局中单独成列。 */
  itemKey?: string
  /** 输出模式；默认按 `WORKFLOW_LOG` 决定，`dev` 一类长驻服务强制 `live`。 */
  log?: LogMode
  /** 是否使用转圈动画；默认启用，关闭时仍显示静态进行中状态。 */
  spin?: boolean
  /** 任务抛错后保留原异常，由调用方处理退出码；默认返回 1。 */
  throwOnError?: boolean
  /** 是否为列表末项；提供时渲染树形连接符。 */
  last?: boolean
}

/** 摘要展示选项。 */
export interface SummaryOptions {
  /** 摘要标题。 */
  title: string
  /** 摘要语气。 */
  tone: Tone
  /** 摘要正文。 */
  content: string
  /** 额外高亮的一行可复制内容。 */
  copy?: string
}

/** 流程开始选项。 */
export interface FlowOptions {
  /** 流程所属领域。 */
  domain: string
  /** 流程标题。 */
  title: string
  /** 流程说明。 */
  description?: string
}

/** 分组开始选项。 */
export interface GroupOptions {
  /** 分组标题。 */
  title: string
  /** 分组说明。 */
  description?: string
  /** 关联目标标识。 */
  itemKey?: string
}

/** 一个正在进行的分组。 */
interface GroupFrame {
  readonly title: string
  readonly itemKey?: string
}

/**
 * 失败详情最多渲染的行数。
 *
 * @remarks `vue-tsc` 之类工具的失败输出常有数百行，全量铺开会淹没结论。这里截断并
 * 显式告知剩余行数，需要完整输出时用 `WORKFLOW_LOG=live`。
 */
const MAX_DETAIL_LINES = 40

/**
 * 失败详情单行的最大宽度。
 *
 * @remarks 类型不匹配错误的展开动辄数百字符，会在终端里反复折行，把锚点列冲散。
 */
const MAX_DETAIL_WIDTH = 140

/** 摘要卡片的最大宽度。 */
const MAX_CARD_WIDTH = 72

/** 摘要卡片的最小宽度，低于此值 Clack 的边框计算会溢出。 */
const MIN_CARD_WIDTH = 36

/** `WORKFLOW_LOG` 的合法取值。 */
const LOG_MODES: ReadonlySet<string> = new Set(["live", "capture"])

/** 光标停在动画下一行时，返回动画行并清空，保持后续日志从行首写入。 */
const CLEAR_SPINNER_LINE = "\u001B[1A\u001B[2K\r"

/**
 * 解析全局日志模式。
 *
 * @param env - 环境变量。
 * @returns 默认日志模式。
 */
export function resolveLogMode(env: NodeJS.ProcessEnv): LogMode {
  const requested = env.WORKFLOW_LOG

  return requested !== undefined && LOG_MODES.has(requested)
    ? (requested as LogMode)
    : "capture"
}

/**
 * 终端 UI 实例。每个命令持有一个实例，状态不跨命令共享。
 */
export class Ui {
  /** 视觉输出流。 */
  readonly out: Writable
  /** 环境变量。 */
  readonly env: NodeJS.ProcessEnv
  /** 当前 group 嵌套深度。 */
  depth = 0
  /** 批处理列布局；为空时任务按单列渲染。 */
  columns: ColumnLayout | undefined

  readonly #groups: GroupFrame[] = []
  #cancelled = false
  #signalsInstalled = false
  #logMode: LogMode = "capture"
  #frame = 0
  #activeRow: TaskRow = { status: "running", label: "" }
  #timer: ReturnType<typeof setInterval> | undefined
  /** 相邻内容块共用一行间隔，避免重复输出空导轨。 */
  #separated = false

  /**
   * @param out - 视觉输出流，默认标准错误。
   * @param env - 环境变量，默认当前进程环境。
   */
  constructor(
    out: InstanceType<typeof Writable> = process.stderr,
    env: NodeJS.ProcessEnv = process.env,
    options: { readonly signals?: boolean } = {}
  ) {
    this.out = out
    this.env = env
    setColorSupport((out as { isTTY?: boolean }).isTTY === true, env)

    // 测试会反复构造实例；关掉信号注册可避免监听器累积。
    if (options.signals !== false) {
      this.#installSignals()
    }
  }

  /** 当前环境是否支持交互式控件。 */
  get interactive(): boolean {
    if (this.env.CI === "true") {
      return false
    }

    const tty = (this.out as { isTTY?: boolean }).isTTY === true

    return tty && (process.stdin as { isTTY?: boolean }).isTTY === true
  }

  /** 是否已经收到中断信号。 */
  get cancelled(): boolean {
    return this.#cancelled
  }

  /**
   * 是否可以展示转圈动画。
   *
   * @remarks 实时子进程输出同样经过 UI 写入，动画始终位于最后一行。
   * 非 TTY 使用静态进行中状态，避免输出光标控制序列。
   */
  get canSpin(): boolean {
    return (this.out as { isTTY?: boolean }).isTTY === true
  }

  /**
   * 开始一行转圈动画。
   *
   * @remarks 任务串行执行，任意时刻至多一行处于进行中，因此只需向上移动一行即可
   * 原地重绘，无需管理多行光标。
   *
   * @param row - 当前任务行。
   * @param spin - 是否展示转圈动画。
   */
  #startSpin(row: TaskRow, spin = true): void {
    this.#activeRow = row
    this.#frame = 0

    if (!this.canSpin || !spin) {
      this.#write(
        formatTaskRow({ ...row, pendingReason: "执行中" }, this.depth, this.columns)
      )

      return
    }

    this.#write(this.#spinLine(0))
    this.#timer = setInterval(() => {
      this.#frame = (this.#frame + 1) % SPINNER_FRAMES.length
      // 每帧都是「回到同一行的行首 → 擦除整行 → 重写 → 再次换行」。
      //
      // 帧尾的换行不可省略：写入后光标必须停在该行的**下一行行首**，下一帧的
      // `cursorUp(1)` 才会正好回到这一行。若帧尾不换行，光标停在本行行尾，下一帧
      // 再上移一行就会逐帧向上爬，最终呈现在终端里铺成一条斜线。
      this.out.write(`${CLEAR_SPINNER_LINE}${this.#spinLine(this.#frame)}\n`)
    }, SPINNER_INTERVAL_MS)
    this.#timer.unref?.()
  }

  /**
   * 停止转圈动画，并用最终文本替换当前行。
   *
   * @param final - 结束后的整行文本。
   */
  #stopSpin(final: string): void {
    if (this.#timer === undefined) {
      this.#write(final)

      return
    }

    clearInterval(this.#timer)
    this.#timer = undefined
    this.out.write(CLEAR_SPINNER_LINE)
    this.#write(final)
    this.#activeRow = { status: "running", label: "" }
  }

  /**
   * 渲染转圈动画行。
   *
   * @param frame - 帧序号。
   * @returns 整行文本。
   */
  #spinLine(frame: number): string {
    // 让转圈帧占据符号位，而不是追加在状态符号之前。
    const line = formatTaskRow(
      { ...this.#activeRow, frame: theme.accent(SPINNER_FRAMES[frame] ?? "") },
      this.depth,
      this.columns
    )

    if (visibleWidth(line) < this.#columns()) {
      return line
    }

    // 动画必须保持一个物理行，长任务名缩短显示，完成结果仍保留全文。
    return `${wrapText(line, this.#columns() - 2)[0] ?? ""}${theme.dim("…")}`
  }

  /**
   * 按当前日志模式运行一个子进程。
   *
   * @remarks 这是业务代码执行子进程的唯一入口。日志模式在此统一翻译成 `capture`，
   * 避免「渲染层以为在捕获、执行层却在透传」这种两层不一致——那种不一致会让失败
   * 输出绕过 UI 结构直接写进终端。
   *
   * @param command - 可执行文件。
   * @param args - 命令参数。
   * @param options - 除 `capture` 与 `onOutput` 外的执行选项。
   * @returns 执行结果。
   */
  async exec(
    command: string,
    args: readonly string[],
    options: Omit<RunOptions, "capture" | "onOutput"> = {}
  ): Promise<RunResult> {
    if (this.#logMode !== "live") {
      return await run(command, args, { ...options, capture: true })
    }

    const pending = { stdout: "", stderr: "" }

    const prefix = railPrefix(this.depth + 1)

    const writeLine = (line: string): void => {
      for (const part of wrapText(
        line.replace(/\r$/, ""),
        this.#columns() - visibleWidth(prefix)
      )) {
        this.#write(`${prefix}${part}`)
      }
    }

    try {
      return await run(command, args, {
        ...options,
        capture: false,
        onOutput: (chunk, stream) => {
          const lines = (pending[stream] + chunk).split("\n")

          pending[stream] = lines.pop() ?? ""
          for (const line of lines) {
            writeLine(line)
          }
        },
      })
    } finally {
      for (const line of Object.values(pending)) {
        if (line !== "") {
          writeLine(line)
        }
      }
    }
  }

  /**
   * 渲染一条中性说明。
   *
   * @param message - 说明文本。
   */
  note(message: string): void {
    for (const line of wrapText(message, this.#columns() - 3 - this.depth * 2)) {
      this.#write(`${railPrefix(this.depth)}${theme.dim(line)}`)
    }
  }

  /**
   * 渲染一条状态消息。
   *
   * @param tone - 语气。
   * @param message - 消息文本。
   */
  status(tone: Tone, message: string): void {
    for (const [index, line] of wrapText(
      message,
      this.#columns() - 5 - this.depth * 2
    ).entries()) {
      const marker = index === 0 ? `${titlePrefix(tone)} ` : "  "

      this.#write(`${railPrefix(this.depth)}${marker}${statusColor(tone)(line)}`)
    }
  }

  /**
   * 渲染一张带边框的摘要卡片。
   *
   * @remarks 宽度按实际终端宽度收敛。Clack 的 `box` 在宽度算得过窄时会以负数调用
   * `String.repeat` 并抛错。因此将目标流的可用列数传给内存流，过窄时降级为带导轨的
   * 文字块，保证摘要渲染不会让整个命令失败。
   *
   * @param options - 摘要选项。
   */
  summary(options: SummaryOptions): void {
    const titleColor =
      options.tone === "neutral" ? theme.accent : statusColor(options.tone)

    const title = titleColor(theme.title(options.title))

    const body = [options.content, ...(options.copy ? [theme.dim(options.copy)] : [])]
      .filter((line) => line.length > 0)
      .join("\n")

    // 卡片先落到内存，再按当前层级加前缀后整体输出；Clack 的 box 没有缩进参数，
    // 直接写出去会与 group 的导轨脱节、卡片像是漂浮在分组之外。
    const indent = railPrefix(this.depth)

    const width = Math.min(MAX_CARD_WIDTH, this.#columns() - visibleWidth(indent))

    this.#write(theme.rail("│"))
    for (const line of this.#renderCard(body, title, width)) {
      this.#write(`${indent}${line}`)
    }

    this.#write(theme.rail("│"))
  }

  /**
   * 把摘要正文渲染成带边框的多行文本。
   *
   * @param body - 正文。
   * @param title - 标题。
   * @param width - 卡片宽度。
   * @returns 逐行文本；渲染失败时降级为标题加正文。
   */
  #renderCard(body: string, title: string, width: number): readonly string[] {
    if (width < MIN_CARD_WIDTH) {
      return [...wrapText(title, width), ...wrapText(body, width)]
    }

    const chunks: string[] = []

    const collector = new Writable({
      write(chunk: unknown, _encoding, done) {
        chunks.push(String(chunk))

        return done()
      },
    })

    Object.assign(collector, { columns: width })

    try {
      box(body, title, {
        output: collector,
        width: "auto",
        withGuide: false,
        rounded: true,
        formatBorder: theme.rail,
      })
    } catch {
      return [...wrapText(title, width), ...wrapText(body, width)]
    }

    const lines = chunks.join("").split("\n")

    return lines.at(-1) === "" ? lines.slice(0, -1) : lines
  }

  /**
   * 推断可用的终端宽度。
   *
   * @returns 终端列数；无法推断时返回默认值。
   */
  #columns(): number {
    const candidates = [
      (this.out as { columns?: number }).columns,
      process.stdout.columns,
      Number.parseInt(process.env.COLUMNS ?? "", 10),
    ]

    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 20) {
        return candidate
      }
    }

    return 80
  }

  /**
   * 开启一次流程。
   *
   * @param options - 流程选项。
   */
  flowBegin(options: FlowOptions): void {
    this.#groups.length = 0
    this.depth = 0
    this.columns = undefined
    this.#write("")
    this.#write(
      `${theme.rail("╭─")} ${theme.accent(options.domain)} ${theme.rail("·")} ${theme.title(options.title)}`
    )
    if (options.description) {
      this.note(options.description)
    }

    this.#write(theme.rail("│"))
  }

  /**
   * 结束当前流程。
   *
   * @param outcome - 终止语气。
   * @param message - 结束说明。
   */
  flowEnd(outcome: Outcome, message: string): void {
    this.#groups.length = 0
    this.depth = 0
    this.columns = undefined
    this.#write(theme.rail("│"))
    this.#write(
      `${theme.rail("╰─")} ${titlePrefix(outcome)} ${statusColor(outcome)(message)}`
    )
    this.#write("")
  }

  /**
   * 依据退出码结束流程，把三态判断收敛到一处。
   *
   * @param exitCode - 子命令退出码。
   * @param messages - 三种终止语气各自对应的说明。
   */
  flowEndFromExitCode(
    exitCode: number,
    messages: { success: string; failed: string; cancelled: string }
  ): void {
    if (exitCode === CANCELLED_EXIT_CODE) {
      this.flowEnd("cancelled", messages.cancelled)

      return
    }

    if (exitCode !== 0) {
      this.flowEnd("failed", messages.failed)

      return
    }

    this.flowEnd("success", messages.success)
  }

  /**
   * 开启一个分组。
   *
   * @param options - 分组选项。
   */
  groupBegin(options: GroupOptions): void {
    this.#write(theme.rail("│"))

    this.#groups.push({
      title: options.title,
      ...(options.itemKey === undefined ? {} : { itemKey: options.itemKey }),
    })
    this.depth = this.#groups.length
    this.#write(formatGroupTitle(options.title, this.depth))
    if (options.description) {
      for (const line of wrapText(
        options.description,
        this.#columns() - 3 - this.depth * 2
      )) {
        this.#write(formatGroupNote(line, this.depth))
      }
    }

    this.#write(theme.rail("│"))
  }

  /**
   * 结束当前分组。
   *
   * @param outcome - 终止语气。
   * @param message - 结束说明。
   */
  groupEnd(outcome: Outcome, message: string): void {
    this.#groups.pop()
    this.depth = this.#groups.length
    this.#write(
      `${railPrefix(this.depth)}${titlePrefix(outcome)} ${statusColor(outcome)(message)}`
    )
    this.#write(theme.rail("│"))
  }

  /**
   * 标记一个被跳过的任务。
   *
   * @param title - 任务标题。
   * @param reason - 跳过原因。
   */
  taskSkip(title: string, reason: string): void {
    this.taskRow({ status: "skipped", label: title, pendingReason: reason })
  }

  /**
   * 渲染一条已完成的任务行。
   *
   * @param row - 任务行内容。
   */
  taskRow(row: TaskRow): void {
    this.#write(formatTaskRow(row, this.depth, this.columns))
  }

  /**
   * 标记一个未执行的任务，用于失败时说明还有多少目标没有跑。
   *
   * @param target - 目标标识。
   * @param label - 任务名称。
   * @param reason - 未执行原因。
   * @param last - 是否为列表末项。
   */
  taskPending(target: string, label: string, reason: string, last = false): void {
    this.taskRow({ status: "pending", target, label, pendingReason: reason, last })
  }

  /**
   * 执行一次任务，并在结束时输出一行结果。
   *
   * @remarks 返回 `RunResult` 表示子进程已执行，退出码由渲染层判断；返回 `void`
   * 表示纯进程内操作，抛错即失败。取消必须由执行逻辑返回退出码 130 表达。
   *
   * @param options - 任务选项。
   * @param execute - 任务逻辑。
   * @returns 退出码；130 表示用户取消。
   * @throws 启用 throwOnError 时透传任务抛出的原始异常。
   */
  async task(
    options: TaskOptions,
    execute: () => Promise<RunResult | void>
  ): Promise<number> {
    this.#logMode = options.log ?? resolveLogMode(this.env)
    const started = Date.now()

    const row = { ...targetOf(options), label: options.title, last: options.last }

    this.#startSpin({ status: "running", ...row }, options.spin ?? true)

    let result: RunResult

    try {
      result = (await execute()) ?? { code: 0, stdout: "", stderr: "", output: "" }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      this.#stopSpin(
        formatTaskRow(
          { status: "error", ...row, duration: Date.now() - started },
          this.depth,
          this.columns
        )
      )

      if (options.throwOnError) {
        throw error
      }

      this.#writeDetail(message)

      return 1
    }

    const duration = Date.now() - started

    if (result.code === CANCELLED_EXIT_CODE) {
      this.#stopSpin(
        formatTaskRow({ status: "cancelled", ...row, duration }, this.depth, this.columns)
      )

      return CANCELLED_EXIT_CODE
    }

    const failed = result.code !== 0

    this.#stopSpin(
      formatTaskRow(
        { status: failed ? "error" : "success", ...row, duration },
        this.depth,
        this.columns
      )
    )

    // warning 不改变工具退出码，但成功任务也必须展示其捕获的诊断。
    // 实时 ui.exec 返回空 output，因此不会重复渲染已输出的日志。
    const hasDiagnostics = result.output.split("\n").some((line) => {
      const tone = classifyDetailLine(line)

      return tone === "warning" || tone === "error"
    })

    if (failed || hasDiagnostics) {
      this.#writeDetail(result.output)
    }

    return result.code
  }

  /**
   * 渲染子进程的诊断详情。
   *
   * @remarks 整块染红会淹没真正需要被读到的错误结论。这里按行判定语义：命令回显
   * （`$ …`）属于上下文，弱化处理；明确的错误标记染红；其余保持弱化，形成 rustc 与
   * eslint 那种「红色只落在结论上」的观感。块状锚点让归属关系一眼可辨。
   *
   * @param detail - 子进程输出。
   */
  #writeDetail(detail: string): void {
    if (detail === "") {
      return
    }

    const ordered = arrangeDetail(detail)

    const shown = selectDetailLines(ordered, MAX_DETAIL_LINES)

    const width = this.#columns() - visibleWidth(formatDetail("", this.depth))

    for (const [index, line] of shown.entries()) {
      const tone = classifyDetailLine(line.text)

      // 类型不匹配错误的展开动辄数百字符，不截断会在终端里反复折行、把锚点列冲散。
      const text =
        line.text.length > MAX_DETAIL_WIDTH
          ? `${line.text.slice(0, MAX_DETAIL_WIDTH - 1)}…`
          : line.text

      for (const [partIndex, part] of wrapText(text, width).entries()) {
        this.#write(
          formatDetail(toneColor(tone)(part), this.depth, index === 0 && partIndex === 0)
        )
      }
    }

    if (ordered.length > shown.length) {
      for (const line of wrapText(
        `… 另有 ${ordered.length - shown.length} 行，设置 WORKFLOW_LOG=live 查看完整输出`,
        width
      )) {
        this.#write(formatDetail(theme.dim(line), this.depth, false))
      }
    }
  }

  /**
   * 以透传方式持续运行一个子进程，用于开发服务器一类的长驻服务。
   *
   * @param options - 任务选项。
   * @param command - 可执行文件。
   * @param args - 命令参数。
   * @param cwd - 工作目录。
   * @returns 子进程退出码；130 表示用户取消。
   */
  async service(
    options: TaskOptions,
    command: string,
    args: readonly string[],
    cwd?: string
  ): Promise<number> {
    return await this.task(
      { ...options, log: "live" },
      async () => await this.exec(command, args, cwd ? { cwd } : {})
    )
  }

  /**
   * 释放 UI 资源。
   *
   * @remarks 清除动画与分组状态，可重复调用。
   */
  cleanup(): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer)
      this.#timer = undefined
      this.out.write(CLEAR_SPINNER_LINE)
    }

    this.#groups.length = 0
    this.depth = 0
    this.#separated = false
  }

  /**
   * 写一行视觉输出。
   *
   * @param line - 文本内容。
   */
  #write(line: string): void {
    const separated = line === theme.rail("│")

    if (separated && this.#separated) {
      return
    }

    this.#separated = separated

    if (this.#timer !== undefined) {
      this.out.write(CLEAR_SPINNER_LINE)
    }

    this.out.write(`${line}\n`)

    if (this.#timer !== undefined) {
      this.out.write(`${this.#spinLine(this.#frame)}\n`)
    }
  }

  /**
   * 注册信号处理：收尾后按约定退出码结束进程。
   */
  #installSignals(): void {
    if (this.#signalsInstalled) {
      return
    }

    this.#signalsInstalled = true

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, () => {
        if (this.#cancelled) {
          return
        }

        this.#cancelled = true
        this.cleanup()
        this.status(
          "warning",
          `收到 ${signal === "SIGINT" ? "Ctrl+C" : "终止信号"}，正在结束流程。`
        )
        process.exit(signal === "SIGINT" ? CANCELLED_EXIT_CODE : 143)
      })
    }
  }
}

/**
 * 按语义类别给文本着色。
 *
 * @param tone - 语义类别。
 * @returns 着色函数。
 */
function toneColor(tone: DetailTone): (text: string) => string {
  switch (tone) {
    case "error":
      return theme.error
    case "warning":
      return theme.warning
    case "command":
      return theme.dim
    case "plain":
      return theme.muted
  }
}

/**
 * 从任务选项中取出目标标识。
 *
 * @param options - 任务选项。
 * @returns 含 target 字段的对象；未提供时为空。
 */
function targetOf(options: TaskOptions): { target?: string } {
  return options.itemKey === undefined ? {} : { target: options.itemKey }
}

/**
 * 返回语气对应的前缀符号。
 *
 * @param tone - 语气。
 * @returns 带色符号。
 */
function titlePrefix(tone: Tone | Outcome): string {
  switch (tone) {
    case "neutral":
    case "info":
      return theme.accent("▸")
    case "success":
      return theme.success("✔")
    case "warning":
      return theme.warning("■")
    case "cancelled":
      return theme.warning("■")
    case "error":
    case "failed":
      return theme.error("✖")
  }
}

/**
 * 返回反馈语气对应的文字颜色。
 *
 * @param tone - 反馈语气或流程结果。
 * @returns 着色函数。
 */
function statusColor(tone: Tone | Outcome): (text: string) => string {
  switch (tone) {
    case "neutral":
      return theme.text
    case "info":
      return theme.accent
    case "success":
      return theme.success
    case "warning":
    case "cancelled":
      return theme.warning
    case "error":
    case "failed":
      return theme.error
  }
}

/** 结果语义类型的再导出，便于调用方类型收窄。 */
export type { Result }

/** 详情块中带语义类别的一行。 */
interface DetailLine {
  /** 行文本。 */
  readonly text: string
  /** 语义类别。 */
  readonly tone: DetailTone
}

/**
 * 按语义重排子进程输出，并去掉重复行。
 *
 * @remarks stdout 与 stderr 是两条独立的流，合并后时序会错位：pnpm 的命令回显写在
 * stderr，错误结论写在 stdout，直接拼接会让「跑了什么」落到「错在哪」之后。这里按
 * 「命令 → 其他输出 → 错误结论」重排，与着色规则保持一致；相邻重复行（如 pnpm 在两个
 * 流里各写一次的 `[ELIFECYCLE]`）只保留一份。
 *
 * @param detail - 合并后的子进程输出。
 * @returns 重排并去重后的行。
 */
function arrangeDetail(detail: string): readonly DetailLine[] {
  const buckets: Record<DetailTone, string[]> = {
    command: [],
    plain: [],
    warning: [],
    error: [],
  }

  for (const text of detail.split("\n")) {
    const trimmed = text.trimEnd()

    if (trimmed === "") {
      continue
    }

    buckets[classifyDetailLine(trimmed)].push(trimmed)
  }

  return (["command", "plain", "warning", "error"] as const)
    .flatMap((tone) => buckets[tone])
    .filter((text, index, all) => index === 0 || text !== all[index - 1])
    .map((text) => ({ text, tone: classifyDetailLine(text) }))
}

/**
 * 在行数预算内挑选要展示的行。
 *
 * @remarks 错误结论排在最后，若简单截断尾部，最需要看的内容反而会被丢掉。这里先为
 * 错误与警告预留额度，剩余额度再按原顺序补足前面的上下文。
 *
 * @param lines - 全部候选行。
 * @param budget - 最多展示的行数。
 * @returns 选中的行，保持原有顺序。
 */
function selectDetailLines(
  lines: readonly DetailLine[],
  budget: number
): readonly DetailLine[] {
  if (lines.length <= budget) {
    return lines
  }

  // 错误优先于警告；两者都先于普通命令和成功日志保留。
  const errors = lines.filter((line) => line.tone === "error")

  const warnings = lines.filter((line) => line.tone === "warning")

  const diagnosticQuota = Math.min(
    errors.length + warnings.length,
    Math.max(budget - 8, Math.ceil(budget * 0.6))
  )

  const keptErrors = errors.slice(-Math.min(errors.length, diagnosticQuota))

  const warningQuota = diagnosticQuota - keptErrors.length

  const keptWarnings = warnings.slice(Math.max(0, warnings.length - warningQuota))

  const head: DetailLine[] = []

  for (const line of lines) {
    if (line.tone === "error" || line.tone === "warning") {
      continue
    }

    if (head.length >= budget - keptErrors.length - keptWarnings.length) {
      break
    }

    head.push(line)
  }

  return [...head, ...keptWarnings, ...keptErrors]
}
