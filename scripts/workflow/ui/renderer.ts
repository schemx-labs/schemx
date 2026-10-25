// 单个终端实例的追加式输出、间隔与原生日志边界。
import { stripVTControlCharacters } from "node:util"

import {
  UI_LAYOUT,
  UI_LOADING,
  UI_PROMPT_APPEARANCE,
  UI_RAIL,
  UI_TASK_TEXT,
} from "./config.ts"
import { visibleWidth, wrapText } from "./text-layout.ts"

import type { Formatter } from "./theme.ts"
import type { Writable } from "node:stream"

/**
 * 描述输出流可选的终端能力；普通 Writable 也可以作为输出资源。
 */
export interface TerminalOutput extends Writable {
  /**
   * 仅真正的 TTY 才启用交互和颜色。
   */
  readonly isTTY?: boolean
  /**
   * 当前终端列数；缺省时由环境或默认宽度补足。
   */
  readonly columns?: number
  /**
   * 当前终端行数，供交互控件布局使用。
   */
  readonly rows?: number
}

// 各种导轨统一对齐到最宽字形，另外保留一列间隔。
const GUIDE_COLUMNS = Math.max(...Object.values(UI_RAIL).map(visibleWidth)) + 1

// 渲染依赖由实例注入，不拥有目标流。
interface RendererOptions {
  // 工作流文字和导轨的共同输出目标。
  readonly output: TerminalOutput
  // 终端没有提供列数时读取 COLUMNS。
  readonly env: NodeJS.ProcessEnv
  // 实例的语义色格式化函数。
  readonly format: Formatter
}

// 一次主线输出；原生日志不使用这个入口。
interface WriteOptions {
  // 保留显式换行和颜色序列的正文。
  readonly content: string
  // 正文比标题额外缩进两格。
  readonly detail?: boolean
  // 首行连接符，后续换行始终使用竖线。
  readonly edge?: string
}

/**
 * 协调工作流、原生日志和交互控件的主线状态，仅供 UI 内部使用。
 */
export interface Renderer {
  /**
   * 输出带主线的文本，并按可见列宽自动换行。
   * @param options - 内容、缩进档位和首行连接符。
   */
  write(this: void, options: WriteOptions): void
  /**
   * 申请留白，相邻申请取最大值而不累加。
   * @param lines - 当前段落申请的空行数。
   */
  space(this: void, lines: number): void
  /**
   * 暂停主线并进入原生日志区域，重复进入不会增加换行。
   */
  beginNative(this: void): void
  /**
   * 释放原生日志的半行保护，保留恢复主线所需的换行。
   * @param inherited - 原生 TTY 的末尾光标位置不可观察，恢复动画前先换行。
   */
  endNative(this: void, inherited?: boolean): void
  /**
   * 透传一块日志，协调动画但不修改日志字节。
   * @param content - 子进程的原始日志。
   * @param stream - 原始输出通道。
   */
  writeNative(this: void, content: string, stream: "stdout" | "stderr"): void
  /**
   * 设置当前活动任务的文字，undefined 表示没有等待中的任务。
   * @param content - 已经格式化的任务标题。
   */
  setLoading(this: void, content?: string): void
  /**
   * 暂停动画并返回幂等恢复函数，供交互控件和原生 TTY 使用。
   */
  pauseLoading(this: void): () => void
  /**
   * 取消输入和子进程结束后，反馈异步清理的等待。
   */
  beginCleanup(this: void): void
  /**
   * 接续交互控件已经绘制的主线，避免重复插入留白。
   * @param trailingLines - 控件结尾已有的空主线行数。
   */
  connect(this: void, trailingLines?: number): void
  /**
   * 为控件保留其自带的第一行导轨，不再次包装交互输出。
   */
  beginPrompt(this: void): void
  /**
   * 当前输出是否仍有可接续的主线。
   */
  readonly connected: boolean
  /**
   * 等待已排入目标流的输出写完，不关闭目标流。
   */
  flush(this: void): Promise<void>
  /**
   * 重置布局状态；目标流仍由调用方持有。
   */
  dispose(this: void): void
}

/**
 * 创建实例自己的导轨和留白状态。
 * @param options - 输出资源与格式化依赖。
 * @example createRenderer({ output: process.stderr, env: process.env, format })
 */
export function createRenderer(options: RendererOptions): Renderer {
  // 动态列数直接从输出流读取，窗口变化后无需缓存失效。
  const { output, env, format } = options

  // 流程结束后断开，后续流程可以重新绘制起点。
  let connected = false

  // 原生日志可能以半行结尾，恢复主线前必须补真实换行。
  let native = false

  // 首次输出之前不插入多余留白。
  let hasOutput = false

  // 延后写入空行，使相邻间隔能够合并。
  let pending = 0

  // 已经输出的空主线行数，用于抵扣待插入留白。
  let trailingLines = 0

  // 动画能力只取决于输出终端，不要求 stdin 同时支持交互。
  const animated = output.isTTY === true && env.CI !== "true" && env.TERM !== "dumb"

  // 只保存展示内容，任务状态仍由 scope-state 持有。
  let loading: string | undefined

  // 嵌套的原生操作和交互控件分别持有自己的暂停令牌。
  const pauses = new Set<symbol>()

  // 半行日志结束前不能在同一行绘制动画。
  let partialNative = false

  // 记录当前是否需要清除动画行及恢复光标。
  let loadingVisible = false

  // 动画帧与延迟均属于当前渲染器，释放时统一停止。
  let delayTimer: ReturnType<typeof setTimeout> | undefined

  // 只有延迟结束后才创建帧定时器。
  let frameTimer: ReturnType<typeof setInterval> | undefined

  // 每次切换活动任务重新从第一帧开始。
  let frame = 0

  // 所有控制序列只发送到反馈流，不进入机器可读的 stdout。
  const escape = String.fromCharCode(27)

  // 移除临时行；普通日志、已完成任务和交互控件不受影响。
  const clearLoading = (): void => {
    if (!loadingVisible) {
      return
    }

    if (!output.destroyed && !output.writableEnded) {
      output.write(`\r${escape}[2K${escape}[?25h`)
    }

    loadingVisible = false
  }

  // 定时器不保持宿主存活，任务结束或暂停后立即释放。
  const stopLoading = (): void => {
    clearTimeout(delayTimer)
    clearInterval(frameTimer)
    delayTimer = undefined
    frameTimer = undefined
    clearLoading()
  }

  // 当前行只显示标题的第一屏宽度；完整标题仍保留在任务开始日志中。
  const drawLoading = (): void => {
    if (
      !loading ||
      pauses.size > 0 ||
      partialNative ||
      output.destroyed ||
      output.writableEnded
    ) {
      return
    }

    const columns = output.columns ?? Number.parseInt(env.COLUMNS ?? "", 10)

    const width =
      Number.isFinite(columns) && columns > 0 ? columns : UI_LAYOUT.FALLBACK_COLUMNS

    const currentFrame = UI_LOADING.FRAMES[frame] ?? UI_LOADING.FRAMES[0]

    const gap = " ".repeat(GUIDE_COLUMNS - visibleWidth(UI_RAIL.LINE))

    const prefix = `${UI_RAIL.LINE}${gap}${currentFrame} `

    const prefixColumns = visibleWidth(prefix)

    if (width < prefixColumns + 1) {
      return
    }

    // 保留末列余量，避免终端自动换行影响清行坐标。
    const title =
      wrapText(
        stripVTControlCharacters(loading),
        Math.max(1, width - prefixColumns - 1)
      )[0] ?? ""

    output.write(
      `${loadingVisible ? "" : `${escape}[?25l`}\r${escape}[2K${format(UI_RAIL.LINE, "rail")}${gap}${format(currentFrame, "accent")} ${title}`
    )
    loadingVisible = true
    frame = (frame + 1) % UI_LOADING.FRAMES.length
  }

  // 短任务只保留静态开始和结束反馈，避免动画闪烁。
  const scheduleLoading = (): void => {
    if (
      !animated ||
      !loading ||
      pauses.size > 0 ||
      partialNative ||
      delayTimer ||
      frameTimer
    ) {
      return
    }

    delayTimer = setTimeout(() => {
      delayTimer = undefined
      drawLoading()
      frameTimer = setInterval(drawLoading, UI_LOADING.INTERVAL_MS)
      frameTimer.unref()
    }, UI_LOADING.DELAY_MS)
    delayTimer.unref()
  }

  // 内容变化表示当前活动任务发生切换，不维护另一套任务记录。
  const setLoading: Renderer["setLoading"] = (content) => {
    if (loading === content) {
      return
    }

    stopLoading()
    loading = content
    frame = 0
    scheduleLoading()
  }

  // 恢复函数可以被取消清理和业务 finally 重复调用。
  const pauseLoading: Renderer["pauseLoading"] = () => {
    const token = Symbol("loading-pause")

    pauses.add(token)
    stopLoading()

    const resume = (): void => {
      pauses.delete(token)
      scheduleLoading()
    }

    return resume
  }

  // 子进程和控件已经收到取消，清理阶段重新取得反馈行。
  const beginCleanup = (): void => {
    pauses.clear()
    partialNative = false
    setLoading(UI_TASK_TEXT.CLEANING_UP)
  }

  // 日志保留各自的通道和字节，半行期间暂停重绘。
  const writeNative: Renderer["writeNative"] = (content, stream) => {
    clearLoading()
    process[stream].write(content)
    partialNative = !content.endsWith("\n")

    if (partialNative) {
      stopLoading()
    } else {
      scheduleLoading()
    }
  }

  // 命令关闭后允许外层任务继续展示，原生日志边界仍由 write 处理。
  const endNative: Renderer["endNative"] = (inherited = false) => {
    if (animated && loading && native && (inherited || partialNative)) {
      output.write("\n")
      native = false
    }

    partialNative = false
    scheduleLoading()
  }

  // 与 Renderer.space 的契约一致，只记录最大留白需求。
  const space: Renderer["space"] = (lines) => {
    pending = Math.max(pending, lines)
  }

  // 与 Renderer.connect 的契约一致，复用控件已经绘制的尾部。
  const connect: Renderer["connect"] = (trailing = 0) => {
    connected = true
    hasOutput = true
    trailingLines = trailing
  }

  // 丢弃工作流待写留白，日志区域以真实空行隔开。
  const beginNative = (): void => {
    clearLoading()
    if (native) {
      return
    }

    pending = 0
    connected = false
    trailingLines = 0
    if (hasOutput) {
      output.write("\n")
    }

    native = true
  }

  // Clack 自带一行导轨，因此这里只补剩余间隔。
  const beginPrompt = (): void => {
    clearLoading()
    if (native) {
      output.write("\n")
      native = false
      partialNative = false
    }

    if (hasOutput) {
      // 控件自带导轨时抵扣其首行；关闭导轨后由工作流补齐全部留白。
      for (
        let index = UI_PROMPT_APPEARANCE.WITH_GUIDE ? 1 : 0;
        index < pending;
        index += 1
      ) {
        output.write(`${format(UI_RAIL.LINE, "rail")}\n`)
      }
    }

    pending = 0
  }

  // 统一前缀宽度和续行标记，深层逻辑分组不增加视觉缩进。
  const write: Renderer["write"] = ({ content, detail = false, edge = UI_RAIL.LINE }) => {
    clearLoading()
    if (native) {
      output.write("\n")
      native = false
      partialNative = false
    }

    if (hasOutput) {
      // 已有空主线行抵扣待插入的间隔。
      for (let index = trailingLines; index < pending; index += 1) {
        output.write(`${format(UI_RAIL.LINE, "rail")}\n`)
      }
    }

    pending = 0
    trailingLines = 0
    // TTY 的实时列数优先于环境变量。
    const columns = output.columns ?? Number.parseInt(env.COLUMNS ?? "", 10)

    // 非法环境值退回默认宽度，不把 NaN 传给换行器。
    const width =
      Number.isFinite(columns) && columns > 0 ? columns : UI_LAYOUT.FALLBACK_COLUMNS

    // 正文缩进由配置提供，导轨列宽由实际字形决定。
    const indent = detail ? " ".repeat(UI_LAYOUT.BODY_INDENT_COLUMNS) : ""

    const prefixColumns = Math.max(GUIDE_COLUMNS, visibleWidth(edge) + 1)

    for (const [index, part] of wrapText(
      content,
      width - prefixColumns - indent.length
    ).entries()) {
      // 起止符仅用于第一行，多行文字沿同一列续接。
      const marker = index === 0 ? edge : UI_RAIL.LINE

      // 不同宽度的连接符使用不同间隔，正文始终从同一列开始。
      const gap = " ".repeat(prefixColumns - visibleWidth(marker))

      trailingLines = part === "" ? trailingLines + 1 : 0
      output.write(
        part === ""
          ? `${format(marker, "rail")}\n`
          : `${format(marker, "rail")}${gap}${indent}${part}\n`
      )
    }

    connected = edge !== UI_RAIL.END
    hasOutput = true
    scheduleLoading()
  }

  // 用空写入等待之前的缓冲数据完成，已经关闭的流无需等待。
  const flush = async (): Promise<void> => {
    if (output.destroyed || output.writableEnded) {
      return
    }

    await new Promise<void>(
      /**
       * 将事件驱动的完成结果转换为可等待的 Promise。
       * @param resolve - 操作完成后结算当前等待。
       * @param reject - 将操作错误保留给调用方。
       */ (resolve, reject) => {
        /**
         * 将流写入结果传给刷新请求。
         * @param error - 目标流写入失败；成功时为空。
         */
        const onWritten = (error?: Error | null): void => {
          if (error) {
            reject(error)

            return
          }

          resolve()
        }

        output.write("", onWritten)
      }
    )
  }

  // 释放展示状态，不销毁注入的输出流。
  const dispose = (): void => {
    stopLoading()
    loading = undefined
    pauses.clear()
    connected = false
    native = false
    pending = 0
    trailingLines = 0
    hasOutput = false
  }

  // 只读属性始终反映闭包中的实时连接状态。
  const getConnected = (): boolean => connected

  // 先满足接口结构，再将 connected 替换为实时只读访问器。
  const renderer: Renderer = {
    write,
    space,
    beginNative,
    endNative,
    writeNative,
    setLoading,
    pauseLoading,
    beginCleanup,
    beginPrompt,
    connect,
    connected: false,
    flush,
    dispose,
  }

  Object.defineProperty(renderer, "connected", { get: getConnected })

  return renderer
}
