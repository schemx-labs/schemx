// 基础消息展示和摘要组合，不管理范围状态。
import { UI_ERROR_TEXT, UI_ICON, UI_LAYOUT, UI_SEPARATOR } from "./config.ts"
import { UI_MESSAGE_ROLE, UI_SUMMARY_ROLE } from "./theme.ts"

import type { Renderer } from "./renderer.ts"
import type { ParentId } from "./scope-state.ts"
import type { Formatter, TerminalRole } from "./theme.ts"

/**
 * 消息语气。
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "error"

/**
 * 独立格式化，不触发输出。
 */
export interface FormatTextOptions {
  /**
   * 原始文字；格式化不会触发终端输出。
   */
  readonly content: string
  /**
   * 选择主题中的语义色角色。
   */
  readonly role: TerminalRole
}

/**
 * 可关联到流程、分组或任务的文本。
 */
export interface TextOptions {
  /**
   * 正文，保留显式空行和已有 ANSI 颜色。
   */
  readonly content: string
  /**
   * 可选的实例内父范围，必须尚未结束。
   */
  readonly parentId?: ParentId | undefined
}

/**
 * 标题展示。
 */
export interface HeadingOptions {
  /**
   * 显示标题，不作为范围标识。
   */
  readonly title: string
  /**
   * 可选的实例内父范围，必须尚未结束。
   */
  readonly parentId?: ParentId | undefined
}

/**
 * 消息展示。
 */
export interface MessageOptions {
  /**
   * 已经由消费端准备好的可读消息。
   */
  readonly message: string
  /**
   * 可选的实例内父范围，必须尚未结束。
   */
  readonly parentId?: ParentId | undefined
}

/**
 * 动态消息语气。
 */
export interface StatusOptions extends MessageOptions {
  /**
   * 决定状态标记及消息的语义色。
   */
  readonly tone: Tone
}

/**
 * 字段值由消费端准备，不解释项目语义。
 */
export interface TerminalField {
  /**
   * 字段名称，展示时统一添加中文冒号。
   */
  readonly label: string
  /**
   * 字段值，按字符串显示，不执行序列化或业务解析。
   */
  readonly value: string | number | boolean
}

/**
 * 按消费端提供的顺序输出字段，不推断业务含义。
 */
export interface FieldsOptions {
  /**
   * 按显示顺序排列的字段。
   */
  readonly items: readonly TerminalField[]
  /**
   * 所有字段共同关联的可选父范围。
   */
  readonly parentId?: ParentId | undefined
}

/**
 * 逐项输出列表，保留列表项内部的颜色和换行。
 */
export interface ListOptions {
  /**
   * 按显示顺序排列的列表正文。
   */
  readonly items: readonly string[]
  /**
   * 所有列表项共同关联的可选父范围。
   */
  readonly parentId?: ParentId | undefined
}

/**
 * 常用摘要组合。code 只展示代码或命令。
 */
export interface SummaryOptions extends HeadingOptions {
  /**
   * 摘要正文；空字符串时省略正文。
   */
  readonly content: string
  /**
   * 标题语气，默认使用强调色。
   */
  readonly tone?: Tone
  /**
   * 可选的可复制代码或命令，只展示而不执行。
   */
  readonly code?: string
}

/**
 * 公开内容输出能力。
 */
export interface TerminalMessages {
  /**
   * 只返回格式化字符串，不写入终端。
   * @param options - 文字和语义色角色，不触发写入。
   * @example terminal.formatText({ content: "pnpm build", role: "command" })
   */
  formatText(this: void, options: FormatTextOptions): string
  /**
   * 输出标题，保留主线和标题层级。
   * @param options - 标题及可选父范围。
   * @example terminal.heading({ title: "构建结果" })
   */
  heading(this: void, options: HeadingOptions): void
  /**
   * 输出正文，不识别项目路径或关键词。
   * @param options - 完整正文及可选父范围。
   * @example terminal.text({ content: "正在准备配置。" })
   */
  text(this: void, options: TextOptions): void
  /**
   * 按指定语气输出消息。
   * @param options - 消息、语气及可选父范围。
   * @example terminal.status({ tone: "warning", message: "没有可执行目标。" })
   */
  status(this: void, options: StatusOptions): void
  /**
   * 输出普通信息。
   * @param options - 普通信息及可选父范围。
   * @example terminal.info({ message: "开始读取配置。" })
   */
  info(this: void, options: MessageOptions): void
  /**
   * 输出成功信息。
   * @param options - 成功信息及可选父范围。
   * @example terminal.success({ message: "检查通过。" })
   */
  success(this: void, options: MessageOptions): void
  /**
   * 输出警告信息。
   * @param options - 警告信息及可选父范围。
   * @example terminal.warning({ message: "部分目标没有脚本。" })
   */
  warning(this: void, options: MessageOptions): void
  /**
   * 输出错误信息，本方法不抛出异常。
   * @param options - 可读错误文案及可选父范围，不抛出异常。
   * @example terminal.error({ message: "无法读取配置。" })
   */
  error(this: void, options: MessageOptions): void
  /**
   * 逐行显示字段名和字段值。
   * @param options - 有序字段及共同父范围。
   * @example terminal.fields({ items: [{ label: "版本", value: "1.2.3" }] })
   */
  fields(this: void, options: FieldsOptions): void
  /**
   * 逐行显示列表项。
   * @param options - 有序列表项及共同父范围。
   * @example terminal.list({ items: ["core", "vue"] })
   */
  list(this: void, options: ListOptions): void
  /**
   * 展示代码或命令文字，不执行内容。
   * @param options - 只展示的代码或命令及可选父范围。
   * @example terminal.code({ content: "pnpm build" })
   */
  code(this: void, options: TextOptions): void
  /**
   * 组合标题、正文和可选代码，不添加独立边框。
   * @param options - 标题、正文、语气、可复制内容及可选父范围。
   * @example terminal.summary({ title: "检查结果", content: "全部通过。", tone: "success" })
   */
  summary(this: void, options: SummaryOptions): void
}

/**
 * 内部消息操作额外支持原始异常展示，不从公共入口暴露。
 */
export interface Messages extends TerminalMessages {
  /**
   * 按实例的消息样式记录异常载荷。
   * @param failure - 任意异常载荷。
   */
  reportError(this: void, failure: unknown): void
}

/**
 * 将异常载荷转换成可显示文字，不让对象序列化失败覆盖原始异常。
 * @param failure - 调用方抛出的任意值。
 * @example errorMessage(new Error("failed"))
 */
export function errorMessage(failure: unknown): string {
  if (failure instanceof Error) {
    return failure.message
  }

  if (failure !== null && typeof failure === "object") {
    try {
      return JSON.stringify(failure) ?? UI_ERROR_TEXT.UNKNOWN
    } catch {
      return UI_ERROR_TEXT.UNPRINTABLE
    }
  }

  return String(failure)
}

// 只接收内容展示依赖，父级状态由范围登记模块统一校验。
interface MessageEnvironment {
  // 语义色由实例主题决定，不共享全局颜色开关。
  readonly format: Formatter
  // 内容统一交给主线渲染器追加。
  readonly renderer: Renderer
  /**
   * 输出前验证实例和父范围仍可使用。
   * @param parentId - 可选父范围；缺省时只验证实例本身。
   */
  readonly checkParent: (parentId: ParentId | undefined) => void
}

/**
 * 组装基础消息操作，不持有流程、任务或进程级状态。
 * @param environment - 实例渲染能力与范围校验。
 * @example const messages = createMessages(environment)
 */
export function createMessages(environment: MessageEnvironment): Messages {
  // 实例绑定的输出依赖，所有消息方法复用同一主线。
  const { format, renderer, checkParent } = environment

  /**
   * 为不同语气选择固定标记，不引入动画状态。
   * @param tone - 消息语气或流程结果。
   */
  const symbol = (tone: Tone): string => {
    if (tone === "success") {
      return UI_ICON.SUCCESS
    }

    if (tone === "error") {
      return UI_ICON.ERROR
    }

    if (tone === "warning") {
      return UI_ICON.WARNING
    }

    return UI_ICON.INFO
  }

  // 只调用主题格式化，不修改渲染器状态。
  const formatText: TerminalMessages["formatText"] = ({ content, role }) =>
    format(content, role)

  // 标题使用基础缩进，后续换行由统一渲染器补导轨。
  const heading: TerminalMessages["heading"] = ({ title, parentId }) => {
    checkParent(parentId)
    renderer.write({ content: format(title, "heading") })
  }

  // 正文使用第二档缩进，内容不做关键词识别。
  const text: TerminalMessages["text"] = ({ content, parentId }) => {
    checkParent(parentId)
    renderer.write({ content, detail: true })
  }

  // 标记和消息使用同一语义色。
  const status: TerminalMessages["status"] = ({ tone, message, parentId }) => {
    checkParent(parentId)
    // 本条状态消息统一使用的语义色。
    const role = UI_MESSAGE_ROLE[tone]

    renderer.write({ content: `${format(symbol(tone), role)} ${format(message, role)}` })
  }

  // 普通信息复用 status，避免维护第二套标记规则。
  const info: TerminalMessages["info"] = (options) => status({ ...options, tone: "info" })

  // 成功信息复用 status 的固定成功语气。
  const success: TerminalMessages["success"] = (options) =>
    status({ ...options, tone: "success" })

  // 警告信息复用 status 的固定警告语气。
  const warning: TerminalMessages["warning"] = (options) =>
    status({ ...options, tone: "warning" })

  // 错误展示不抛出异常，由消费端决定控制流。
  const error: TerminalMessages["error"] = (options) =>
    status({ ...options, tone: "error" })

  // 字段只做展示转换，不解释路径、版本或业务对象。
  const fields: TerminalMessages["fields"] = ({ items, parentId }) => {
    checkParent(parentId)
    // 项目顺序和重复项均由消费端决定。
    for (const item of items) {
      text({
        content: `${format(`${item.label}${UI_SEPARATOR.FIELD}`, "muted")}${format(String(item.value), "value")}`,
        parentId,
      })
    }
  }

  // 列表项复用正文换行和缩进规则。
  const list: TerminalMessages["list"] = ({ items, parentId }) => {
    checkParent(parentId)
    // 项目顺序和重复项均由消费端决定。
    for (const item of items) {
      text({ content: `${UI_ICON.LIST} ${item}`, parentId })
    }
  }

  // 命令仅上色和展示，不交给进程执行器。
  const code: TerminalMessages["code"] = ({ content, parentId }) =>
    text({ content: format(content, "command"), parentId })

  // 摘要平铺组合基础操作，不使用卡片边框或宽度降级。
  const summary: TerminalMessages["summary"] = (options) => {
    checkParent(options.parentId)
    renderer.space(UI_LAYOUT.SUMMARY_GAP_LINES)
    // 中性摘要仍用强调色突出标题。
    let role: TerminalRole = UI_SUMMARY_ROLE.DEFAULT

    if (options.tone !== undefined) {
      role =
        options.tone === "neutral"
          ? UI_SUMMARY_ROLE.NEUTRAL
          : UI_MESSAGE_ROLE[options.tone]
    }

    heading({ title: format(options.title, role), parentId: options.parentId })
    if (options.content !== "") {
      text({ content: options.content, parentId: options.parentId })
    }

    if (options.code) {
      code({ content: options.code, parentId: options.parentId })
    }

    renderer.space(UI_LAYOUT.SUMMARY_GAP_LINES)
  }

  /**
   * 将任意异常载荷显示为错误消息，不改变调用方控制流。
   * @param failure - 执行或清理阶段抛出的原始载荷。
   */
  const reportError = (failure: unknown): void =>
    error({ message: errorMessage(failure) })

  return {
    reportError,
    formatText,
    heading,
    text,
    status,
    info,
    success,
    warning,
    error,
    fields,
    list,
    code,
    summary,
  }
}
