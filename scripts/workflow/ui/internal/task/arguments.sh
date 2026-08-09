#!/usr/bin/env bash

# 任务 API 参数解析。仅供 task/lifecycle.sh 使用。

# 解析 ui_task 的标题、日志策略和命令参数，并写入任务内部状态变量。
# 参数：接受 `--title`、`--log live|capture` 和 `--` 后的命令。
# 返回：参数合法时返回 0，否则通过 stderr 报错并返回 2。
ui__task_parse() {
  UI__TASK_TITLE=''
  UI__TASK_LOG=live
  UI__TASK_COMMAND=()
  while [[ $# -gt 0 && "$1" != '--' ]]; do
    case "$1" in
      --title) UI__TASK_TITLE="${2:-}"; shift 2 ;;
      --log) UI__TASK_LOG="${2:-}"; shift 2 ;;
      *) ui__write_stderr 'ui_task 用法错误：支持 --title、--log live|capture、--。'; return 2 ;;
    esac
  done
  [[ "${1:-}" == '--' && $# -gt 1 ]] || { ui__write_stderr 'ui_task 用法错误：必须在 -- 后提供命令。'; return 2; }
  shift
  [[ -n "$UI__TASK_TITLE" ]] || { ui__write_stderr 'ui_task 用法错误：必须提供 --title。'; return 2; }
  [[ "$UI__TASK_LOG" == live || "$UI__TASK_LOG" == capture ]] || { ui__write_stderr "未知任务日志策略：$UI__TASK_LOG"; return 2; }
  UI__TASK_COMMAND=("$@")
}

# 解析 ui_service 的标题和持续运行命令，并写入任务内部状态变量。
# 参数：接受 `--title` 和 `--` 后的命令。
# 返回：参数合法时返回 0，否则通过 stderr 报错并返回 2。
ui__service_parse() {
  UI__TASK_TITLE=''
  UI__TASK_COMMAND=()
  while [[ $# -gt 0 && "$1" != '--' ]]; do
    case "$1" in
      --title) UI__TASK_TITLE="${2:-}"; shift 2 ;;
      *) ui__write_stderr 'ui_service 用法错误：支持 --title、--。'; return 2 ;;
    esac
  done
  [[ "${1:-}" == '--' && $# -gt 1 ]] || { ui__write_stderr 'ui_service 用法错误：必须在 -- 后提供命令。'; return 2; }
  shift
  [[ -n "$UI__TASK_TITLE" ]] || { ui__write_stderr 'ui_service 用法错误：必须提供 --title。'; return 2; }
  UI__TASK_COMMAND=("$@")
}
