// 唯一公共运行时入口，其余导出均为稳定类型契约。
export { createTerminal } from "./createTerminal.ts"
export type { Terminal, TerminalOptions } from "./types.ts"
export type { TerminalRole, TerminalColor, TerminalTheme } from "./theme.ts"
export type { FlowId, GroupId, TaskId, ParentId } from "./scope-state.ts"
export type {
  Tone,
  FormatTextOptions,
  TextOptions,
  HeadingOptions,
  MessageOptions,
  StatusOptions,
  TerminalField,
  FieldsOptions,
  ListOptions,
  SummaryOptions,
} from "./messages.ts"
export type {
  Outcome,
  StartFlowOptions,
  EndFlowOptions,
  StartGroupOptions,
  EndGroupOptions,
  StartTaskOptions,
  SucceedTaskOptions,
  FailTaskOptions,
  CancelTaskOptions,
  SkipTaskOptions,
  PendingTaskOptions,
} from "./scopes.ts"
export type { OutputMode, ExecuteCommandOptions, CommandResult } from "./commands.ts"
export type { RunCommandOptions, RunTaskOptions } from "./tasks.ts"
export type {
  Choice,
  ChoiceGroup,
  SelectOptions,
  GroupMultiselectOptions,
  InputOptions,
  ConfirmOptions,
} from "./prompts/createPrompts.ts"
export type { TerminalSignal, SignalListener, OnSignalOptions } from "./session.ts"
