/**
 * 交互控件。
 *
 * @remarks 原实现需要经过「参数解析 → jq 组装临时 JSON → 启动 node 子进程 → 读回结果文件」
 * 四段桥接，共 294 行；Clack 本身可以直接调用，这里保留原退出码契约即可。
 */
import { type Writable } from "node:stream"

import {
  confirm as clackConfirm,
  groupMultiselect as clackGroupMultiselect,
  multiselect as clackMultiselect,
  select as clackSelect,
  text as clackText,
  isCancel,
  type Option,
} from "@clack/prompts"

import { cancelled } from "../core/errors.ts"

/** 单选或多选的候选项。 */
export interface Choice {
  /** 返回值。 */
  value: string
  /** 展示文本。 */
  label: string
  /** 附注说明。 */
  hint?: string
}

/** 分组多选的候选项。 */
export interface GroupChoice {
  /** 分组名。 */
  group: string
  /** 分组内选项。 */
  options: readonly Choice[]
}

/** 交互输出流；默认标准错误，保证 stdout 只承载机器可读结果。 */
let output: Writable = process.stderr

/**
 * 设置交互控件的输出流。
 *
 * @param stream - 目标流。
 */
export function setPromptOutput(stream: Writable): void {
  output = stream
}

/**
 * 把候选项转换为 Clack 选项。
 *
 * @param choices - 候选项。
 * @returns Clack 选项。
 */
function toOptions(choices: readonly Choice[]): Option<string>[] {
  return choices.map((choice) =>
    choice.hint === undefined
      ? { value: choice.value, label: choice.label }
      : { value: choice.value, label: choice.label, hint: choice.hint }
  )
}

/**
 * 渲染单选控件。
 *
 * @param message - 提示文本。
 * @param choices - 候选项。
 * @returns 用户选择的值。
 * @throws {WorkflowError} 用户取消时抛出携带 130 的错误。
 */
export async function select(
  message: string,
  choices: readonly Choice[]
): Promise<string> {
  const value = await clackSelect({ message, options: toOptions(choices), output })

  if (isCancel(value)) {
    throw cancelled("已取消选择。")
  }

  return value
}

/**
 * 渲染多选控件。
 *
 * @param message - 提示文本。
 * @param choices - 候选项。
 * @returns 用户选择的值列表。
 * @throws {WorkflowError} 用户取消时抛出携带 130 的错误。
 */
export async function multiselect(
  message: string,
  choices: readonly Choice[]
): Promise<string[]> {
  const value = await clackMultiselect({
    message,
    options: toOptions(choices),
    required: true,
    output,
  })

  if (isCancel(value)) {
    throw cancelled("已取消选择。")
  }

  return value
}

/**
 * 渲染分组多选控件。
 *
 * @param message - 提示文本。
 * @param groups - 分组候选项。
 * @returns 用户选择的值列表。
 * @throws {WorkflowError} 用户取消时抛出携带 130 的错误。
 */
export async function groupMultiselect(
  message: string,
  groups: readonly GroupChoice[]
): Promise<string[]> {
  const options: Record<string, Option<string>[]> = {}

  for (const group of groups) {
    if ((options[group.group] ??= []).length === 0) {
      options[group.group] = toOptions(group.options)
    }
  }

  const value = await clackGroupMultiselect({
    message,
    options,
    required: true,
    selectableGroups: true,
    output,
  })

  if (isCancel(value)) {
    throw cancelled("已取消选择。")
  }

  return value
}

/**
 * 渲染文本输入控件。
 *
 * @param message - 提示文本。
 * @param placeholder - 占位文本。
 * @returns 用户输入的文本。
 * @throws {WorkflowError} 用户取消时抛出携带 130 的错误。
 */
export async function text(message: string, placeholder: string): Promise<string> {
  const value = await clackText({ message, placeholder, output })

  if (isCancel(value)) {
    throw cancelled("已取消输入。")
  }

  return value
}

/**
 * 渲染确认控件。
 *
 * @remarks 非交互环境只在显式设置 SCHEMX_UI_ASSUME_YES=true 时视为确认，
 * 与原实现的 CI 行为保持一致。
 *
 * @param message - 提示文本。
 * @param assumeYes - 非交互时是否视为确认。
 * @returns 是否确认。
 * @throws {WorkflowError} 用户取消时抛出携带 130 的错误。
 */
export async function confirm(message: string, assumeYes: boolean): Promise<boolean> {
  if (!process.stdin.isTTY && assumeYes) {
    return true
  }

  const value = await clackConfirm({ message, output })

  if (isCancel(value)) {
    throw cancelled("已取消确认。")
  }

  return value
}
