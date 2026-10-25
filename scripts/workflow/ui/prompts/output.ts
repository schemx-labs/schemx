// 仅适配 Clack 的导轨与颜色，不改变重绘的物理行数或光标控制。
import { Writable } from "node:stream"
import { stripVTControlCharacters } from "node:util"

import { UI_RAIL } from "../config.ts"

import type { Renderer, TerminalOutput } from "../renderer.ts"
import type { Formatter } from "../theme.ts"

// 交互流借用目标输出，不拥有其关闭权限。
interface PromptOutputOptions {
  // 与工作流共用的实际输出目标及动态终端尺寸。
  readonly output: TerminalOutput
  // 用于替换控件默认颜色的实例主题。
  readonly format: Formatter
  // 用控件已有的主线更新工作流连接状态。
  readonly renderer: Renderer
}

// 适配流可以独立销毁，不影响实际输出目标。
interface PromptOutput {
  // Clack 写入的中间流，保留其光标控制序列。
  readonly stream: Writable
  // 移除尺寸监听并销毁中间流。
  dispose(this: void): void
}

// 用字符码构造转义前缀，避免源文件含有裸控制字符。
const ESC = String.fromCharCode(27)

// 只匹配颜色和字体属性，不吞掉重绘的光标控制序列。
const SGR = new RegExp(`${ESC}\\[[0-9;]*m`, "g")

// 保留行首光标控制，将控件的竖线和末端折角统一到主线。
const GUIDE = new RegExp(
  `(^|\\n)((?:${ESC}\\[[0-?]*[ -/]*[@-~])*)([│└])((?:${ESC}\\[[0-9;]*m)*)`,
  "g"
)

// 仅替换 Clack 使用的状态色和强调色，保留其他文本内容。
const PROMPT_COLOR = new RegExp(
  `${ESC}\\[(31|32|33|36|91|92|93|96)m([^${ESC}]*)${ESC}\\[39m`,
  "g"
)

/**
 * 创建本实例的交互适配流。
 * @param options - 目标流、实例主题及主线状态。
 * @example createPromptOutput({ output: process.stderr, format, renderer })
 */
export function createPromptOutput(options: PromptOutputOptions): PromptOutput {
  // 控件重绘和工作流文字始终写入同一目标。
  const { output, format, renderer } = options

  // Formatter 在实例生命周期中不变，沿用强调色探针判断是否清除 SGR。
  const stripColors = format("x", "accent") === "x"

  /**
   * 同步透传当前重绘块，避免适配流队列落后于后续工作流标题。
   * @param chunk - Clack 当前写入的 UTF-8 重绘数据。
   * @param _encoding - Writable 提供的编码，缓冲区已统一为字节。
   * @param done - 当前数据块完成回调，可接收写入错误；不等待实际目标流排空。
   */
  const write = (
    chunk: Buffer,
    _encoding: BufferEncoding,
    done: (error?: Error | null) => void
  ): void => {
    // 只有包含主线标记的重绘块才更新布局连接状态。
    let sawGuide = false

    /**
     * 替换导轨颜色，同时保留前置光标控制。
     * @param _match - 完整的控件导轨匹配。
     * @param start - 文本起点或前一行换行符。
     * @param controls - 行首 ANSI 控制序列。
     */
    const replaceGuide = (_match: string, start: string, controls: string): string => {
      sawGuide = true

      return `${start}${controls.replace(SGR, "")}${format(UI_RAIL.LINE, "rail")}`
    }

    /**
     * 将控件状态色映射到实例语义色。
     * @param _match - 原有颜色及文字的完整匹配。
     * @param color - 原有 ANSI 前景色编号。
     * @param content - 颜色包裹的文字。
     */
    const replaceColor = (_match: string, color: string, content: string): string => {
      if (color === "31" || color === "91") {
        return format(content, "error")
      }

      if (color === "32" || color === "92") {
        return format(content, "success")
      }

      if (color === "33" || color === "93") {
        return format(content, "warning")
      }

      return format(content, "accent")
    }

    // 替换不改变物理行数，控件原有的重绘坐标仍然有效。
    let rendered = chunk
      .toString()
      .replace(GUIDE, replaceGuide)
      .replace(PROMPT_COLOR, replaceColor)

    if (stripColors) {
      rendered = rendered.replace(SGR, "")
    }

    if (sawGuide) {
      // 只在计数时移除控制字符，实际透传内容保持原有光标指令。
      const lines = stripVTControlCharacters(rendered).trimEnd().split("\n")

      // 控件尾部已有的空导轨可以抵扣工作流待写间隔。
      let trailing = 0

      // 从最后一个非空物理行反向统计连续导轨。
      for (
        let index = lines.length - 1;
        index >= 0 && lines[index]?.trim() === UI_RAIL.LINE;
        index -= 1
      ) {
        trailing += 1
      }

      renderer.connect(trailing)
    }

    output.write(rendered)
    done()
  }

  // 单独的中间流隔离控件对生命周期和重绘的操作。
  const stream = new Writable({ write })

  // 尺寸和 TTY 能力实时转发，窗口缩放时不依赖过期副本。
  const getIsTTY = (): boolean | undefined => output.isTTY

  // 列宽由真实目标流决定。
  const getColumns = (): number | undefined => output.columns

  // 屏幕行数由真实目标流决定。
  const getRows = (): number | undefined => output.rows

  Object.defineProperties(stream, {
    isTTY: { get: getIsTTY },
    columns: { get: getColumns },
    rows: { get: getRows },
  })
  // 让 Clack 继续接收真实目标流的尺寸变化。
  const resize = (): boolean => stream.emit("resize")

  output.on("resize", resize)
  // 移除本实例添加的监听，不关闭调用方的实际输出流。
  const dispose = (): void => {
    output.off("resize", resize)
    stream.destroy()
  }

  return { stream, dispose }
}
