/**
 * 实例绑定的交互能力，不读取工作流环境变量或共享输出状态。
 */
import {
  confirm as clackConfirm,
  groupMultiselect as clackGroupMultiselect,
  multiselect as clackMultiselect,
  select as clackSelect,
  text as clackText,
  isCancel,
} from "@clack/prompts"

import { UI_PROMPT_APPEARANCE, UI_PROMPT_TEXT } from "../config.ts"

import { createPromptOutput } from "./output.ts"

import type { Renderer, TerminalOutput } from "../renderer.ts"
import type { Formatter } from "../theme.ts"
import type { Option } from "@clack/prompts"
import type { Readable } from "node:stream"

/**
 * 始终要求展示标签，不向外暴露交互库类型。
 * @typeParam TValue - 候选项携带的值。
 */
export interface Choice<TValue> {
  /**
   * 直接作为选择结果返回的原始值。
   */
  readonly value: TValue
  /**
   * 始终显式提供显示标签，支持对象等任意值。
   */
  readonly label: string
  /**
   * 可选辅助说明。
   */
  readonly hint?: string
}

/**
 * 分组选择项。
 * @typeParam TValue - 候选项值与选择结果的共同类型。
 */
export interface ChoiceGroup<TValue> {
  /**
   * 分组显示名称，同一次问题中应保持唯一。
   */
  readonly title: string
  /**
   * 属于该组的候选项。
   */
  readonly options: readonly Choice<TValue>[]
}

/**
 * 单选和多选的共同输入。
 * @typeParam TValue - 候选项值类型。
 */
export interface SelectOptions<TValue> {
  /**
   * 显示给用户的问题。
   */
  readonly title: string
  /**
   * 候选项及其原始值。
   */
  readonly options: readonly Choice<TValue>[]
}

/**
 * 分组多选输入。
 * @typeParam TValue - 各组候选项的值类型。
 */
export interface GroupMultiselectOptions<TValue> {
  /**
   * 显示给用户的问题。
   */
  readonly title: string
  /**
   * 按显示顺序排列的候选分组。
   */
  readonly groups: readonly ChoiceGroup<TValue>[]
}

/**
 * 文本输入的显示配置。
 */
export interface InputOptions {
  /**
   * 文本输入的问题或标签。
   */
  readonly title: string
  /**
   * 仅供提示的占位内容，不作为默认返回值。
   */
  readonly placeholder?: string
}

/**
 * 确认问题及非交互环境的显式放行策略。
 */
export interface ConfirmOptions {
  /**
   * 需要用户确认的问题。
   */
  readonly title: string
  /**
   * 仅在非交互环境中显式为 true 时直接通过。
   */
  readonly assumeYes?: boolean
}

/**
 * 公开交互能力，隐藏控件库类型。
 */
export interface TerminalPrompts {
  /**
   * 返回选中项的值。
   * @typeParam TValue - 候选项值类型。
   * @param options - 问题和候选项。
   * @example const value = await terminal.select({ title: "目标", options: [{ value: "core", label: "Core" }] })
   */
  select<TValue>(this: void, options: SelectOptions<TValue>): Promise<TValue>
  /**
   * 返回选中项的值数组。
   * @typeParam TValue - 候选项值类型。
   * @param options - 问题和候选项。
   * @example const values = await terminal.multiselect({ title: "目标", options: [{ value: "core", label: "Core" }] })
   */
  multiselect<TValue>(this: void, options: SelectOptions<TValue>): Promise<TValue[]>
  /**
   * 返回各组中选中的值。
   * @typeParam TValue - 候选项值类型。
   * @param options - 问题和分组候选项。
   * @example const values = await terminal.groupMultiselect({ title: "目标", groups: [{ title: "Packages", options: [{ value: "core", label: "Core" }] }] })
   */
  groupMultiselect<TValue>(
    this: void,
    options: GroupMultiselectOptions<TValue>
  ): Promise<TValue[]>
  /**
   * 读取文本输入，用户取消时抛出 AbortError。
   * @param options - 问题标题和可选占位内容。
   * @example const version = await terminal.input({ title: "版本", placeholder: "1.2.3" })
   */
  input(this: void, options: InputOptions): Promise<string>
  /**
   * 读取确认，非交互环境仅在显式 assumeYes 时自动通过。
   * @param options - 问题标题和非交互环境的显式放行策略。
   * @example const confirmed = await terminal.confirm({ title: "继续执行？", assumeYes: false })
   */
  confirm(this: void, options: ConfirmOptions): Promise<boolean>
}

/**
 * 内部交互模块同时拥有其输出适配流的释放。
 */
export interface Prompts extends TerminalPrompts {
  /**
   * 销毁适配流并注销尺寸监听，不关闭注入输出流。
   */
  dispose(this: void): void
}

// 每个控件只借用实例资源，当前控件状态保留在工厂闭包中。
interface PromptEnvironment {
  // 输入绑定到本实例，避免隐式读取 process.stdin。
  readonly input: Readable
  // 只向适配流写入，保留控件自己的导轨和重绘。
  readonly output: TerminalOutput
  // 问题标题使用实例的标题语义色。
  readonly format: Formatter
  // 进入控件前处理原生日志和待写间隔。
  readonly renderer: Renderer
  // 实例释放或信号取消时中止正在运行的控件。
  readonly signal: AbortSignal
  // 创建实例时确定的交互能力。
  readonly interactive: boolean
  // 开始操作前验证实例未释放且未取消。
  readonly check: () => void
  // 读取信号协调器的退出屏障，防止顶层 AbortError 抢先终止宿主。
  readonly signalExit: () => Promise<never> | undefined
}

/**
 * Clack 的条件选项类型要求对象值有 label，公开 Choice 总是满足此条件。
 * @typeParam TValue - 候选项原始值，与选择结果保持同一类型。
 * @param choices - 带显示标签的候选项。
 */
function toOptions<TValue>(choices: readonly Choice<TValue>[]): Option<TValue>[] {
  return choices.map(
    /**
     * 复制候选项以适配控件类型，不转换其原始值。
     * @param choice - 带显式显示标签的公共候选项。
     */
    (choice) => ({ ...choice }) as Option<TValue>
  )
}

/**
 * 创建绑定输入、输出与取消信号的交互操作。
 * @param environment - 本实例终端资源。
 * @example const prompts = createPrompts(environment)
 */
export function createPrompts(environment: PromptEnvironment): Prompts {
  // 输出适配资源与控件共同创建和释放。
  const promptOutput = createPromptOutput({
    output: environment.output,
    format: environment.format,
    renderer: environment.renderer,
  })

  // 同一终端只允许一个控件重绘，防止光标控制相互覆盖。
  let active = false

  // 控件活动期间独占光标，结束后恢复外层任务。
  let resumeLoading: (() => void) | undefined

  // 正常返回、输入取消和异常均释放同一份暂停令牌。
  const finish = (): void => {
    active = false
    resumeLoading?.()
    resumeLoading = undefined
  }

  // 接管信号时等待协调器统一退出，不让交互取消异常抢先向上传播。
  const waitForSignalExit = async (): Promise<void> => {
    // 读取实时退出屏障，普通控件取消时不存在该屏障。
    const exiting = environment.signalExit()

    if (exiting) {
      await exiting
    }
  }

  // 拒绝非交互或重入场景，并在绘制前对齐主线。
  const begin = (): void => {
    environment.check()
    if (!environment.interactive) {
      throw new Error(UI_PROMPT_TEXT.UNSUPPORTED)
    }

    if (active) {
      throw new Error(UI_PROMPT_TEXT.ALREADY_ACTIVE)
    }

    active = true
    resumeLoading = environment.renderer.pauseLoading()
    environment.renderer.beginPrompt()
  }

  // 单选保留候选项原值，适配库取消哨兵为统一 AbortError。
  const select: TerminalPrompts["select"] = async <TValue>(
    options: SelectOptions<TValue>
  ): Promise<TValue> => {
    begin()
    try {
      // 先等待可能存在的信号清理，再检查控件返回的取消哨兵。
      const result = await clackSelect<TValue>({
        message: environment.format(options.title, "heading"),
        options: toOptions(options.options),
        input: environment.input,
        output: promptOutput.stream,
        signal: environment.signal,
        withGuide: UI_PROMPT_APPEARANCE.WITH_GUIDE,
      })

      await waitForSignalExit()
      if (isCancel(result)) {
        throw new DOMException(UI_PROMPT_TEXT.SELECTION_CANCELLED, "AbortError")
      }

      return result
    } finally {
      finish()
    }
  }

  // 多选要求至少一项，返回值不转换成展示标签。
  const multiselect: TerminalPrompts["multiselect"] = async <TValue>(
    options: SelectOptions<TValue>
  ): Promise<TValue[]> => {
    begin()
    try {
      // 先等待可能存在的信号清理，再检查控件返回的取消哨兵。
      const result = await clackMultiselect<TValue>({
        message: environment.format(options.title, "heading"),
        options: toOptions(options.options),
        input: environment.input,
        output: promptOutput.stream,
        signal: environment.signal,
        withGuide: UI_PROMPT_APPEARANCE.WITH_GUIDE,
        required: true,
      })

      await waitForSignalExit()
      if (isCancel(result)) {
        throw new DOMException(UI_PROMPT_TEXT.SELECTION_CANCELLED, "AbortError")
      }

      return result
    } finally {
      finish()
    }
  }

  // 将公开分组转换为 Clack 输入，不将其类型暴露给消费端。
  const groupMultiselect: TerminalPrompts["groupMultiselect"] = async <TValue>(
    options: GroupMultiselectOptions<TValue>
  ): Promise<TValue[]> => {
    begin()
    try {
      // 按显示名称建立控件分组，名称需由消费端保持唯一。
      const groups: Record<string, Option<TValue>[]> = {}

      // 保持消费端的分组顺序及组内顺序。
      for (const group of options.groups) {
        groups[group.title] = toOptions(group.options)
      }

      // 先等待可能存在的信号清理，再检查控件返回的取消哨兵。
      const result = await clackGroupMultiselect<TValue>({
        message: environment.format(options.title, "heading"),
        options: groups,
        input: environment.input,
        output: promptOutput.stream,
        signal: environment.signal,
        withGuide: UI_PROMPT_APPEARANCE.WITH_GUIDE,
        required: true,
      })

      await waitForSignalExit()
      if (isCancel(result)) {
        throw new DOMException(UI_PROMPT_TEXT.SELECTION_CANCELLED, "AbortError")
      }

      return result
    } finally {
      finish()
    }
  }

  // 文本输入仍由控件管理编辑和重绘，本层只统一取消契约。
  const input: TerminalPrompts["input"] = async (
    options: InputOptions
  ): Promise<string> => {
    begin()
    try {
      // 先等待可能存在的信号清理，再检查控件返回的取消哨兵。
      const result = await clackText({
        message: environment.format(options.title, "heading"),
        ...(options.placeholder === undefined
          ? {}
          : { placeholder: options.placeholder }),
        input: environment.input,
        output: promptOutput.stream,
        signal: environment.signal,
        withGuide: UI_PROMPT_APPEARANCE.WITH_GUIDE,
      })

      await waitForSignalExit()
      if (isCancel(result)) {
        throw new DOMException(UI_PROMPT_TEXT.INPUT_CANCELLED, "AbortError")
      }

      return result
    } finally {
      finish()
    }
  }

  // 仅非交互且显式 assumeYes 时自动放行，交互时仍显示问题。
  const confirm: TerminalPrompts["confirm"] = async (
    options: ConfirmOptions
  ): Promise<boolean> => {
    environment.check()
    if (!environment.interactive && options.assumeYes === true) {
      return true
    }

    begin()
    try {
      // 先等待可能存在的信号清理，再检查控件返回的取消哨兵。
      const result = await clackConfirm({
        message: environment.format(options.title, "heading"),
        input: environment.input,
        output: promptOutput.stream,
        signal: environment.signal,
        withGuide: UI_PROMPT_APPEARANCE.WITH_GUIDE,
      })

      await waitForSignalExit()
      if (isCancel(result)) {
        throw new DOMException(UI_PROMPT_TEXT.CONFIRMATION_CANCELLED, "AbortError")
      }

      return result
    } finally {
      finish()
    }
  }

  // 控件模块只释放自有适配流，实例信号由 session 管理。
  const dispose = promptOutput.dispose

  return { select, multiselect, groupMultiselect, input, confirm, dispose }
}
