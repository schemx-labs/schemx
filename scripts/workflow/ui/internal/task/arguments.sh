#!/usr/bin/env bash

# 任务 API 参数解析。仅供 task/lifecycle.sh 使用。

# 解析 ui_task 的标题、业务项、日志策略、TTY 直通模式和命令参数，并写入任务内部状态变量。
# 参数：接受 `--title`、`--item-key`、`--log live|capture`、`--interactive` 和 `--` 后的命令。
# 返回：参数合法时返回 0，否则通过 stderr 报错并返回 2。
ui__task_parse() {
  UI__TASK_TITLE=''
  UI__TASK_LOG=live
  UI__TASK_INTERACTIVE=false
  UI__TASK_SENSITIVE=false
  UI__TASK_ITEM_KEY="${SCHEMX_UI_GROUP_ITEM_KEY:-}"
  UI__TASK_COMMAND=()
  while [[ $# -gt 0 && "$1" != '--' ]]; do
    case "$1" in
      --title) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_task 用法错误：--title 需要文本。'; return 2; }; UI__TASK_TITLE="$2"; shift 2 ;;
      --log) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_task 用法错误：--log 需要策略。'; return 2; }; UI__TASK_LOG="$2"; shift 2 ;;
      --item-key) [[ $# -ge 2 && -n "$2" ]] || { ui__write_stderr 'ui_task 用法错误：--item-key 需要非空值。'; return 2; }; UI__TASK_ITEM_KEY="$2"; shift 2 ;;
      --interactive) UI__TASK_INTERACTIVE=true; shift ;;
      --sensitive) UI__TASK_SENSITIVE=true; shift ;;
      *) ui__write_stderr 'ui_task 用法错误：支持 --title、--item-key、--log live|capture、--interactive、--sensitive、--。'; return 2 ;;
    esac
  done
  [[ "${1:-}" == '--' && $# -gt 1 ]] || { ui__write_stderr 'ui_task 用法错误：必须在 -- 后提供命令。'; return 2; }
  shift
  [[ -n "$UI__TASK_TITLE" ]] || { ui__write_stderr 'ui_task 用法错误：必须提供 --title。'; return 2; }
  [[ "$UI__TASK_LOG" == live || "$UI__TASK_LOG" == capture ]] || { ui__write_stderr "未知任务日志策略：$UI__TASK_LOG"; return 2; }
  [[ "$UI__TASK_INTERACTIVE" == false || "$UI__TASK_LOG" == live ]] || { ui__write_stderr 'ui_task 用法错误：--interactive 仅支持 --log live。'; return 2; }
  UI__TASK_COMMAND=("$@")
}

# 解析 ui_service 的标题、业务项和持续运行命令，并写入任务内部状态变量。
# 参数：接受 `--title`、`--item-key` 和 `--` 后的命令。
# 返回：参数合法时返回 0，否则通过 stderr 报错并返回 2。
ui__service_parse() {
  UI__TASK_TITLE=''
  UI__TASK_SENSITIVE=false
  UI__TASK_ITEM_KEY="${SCHEMX_UI_GROUP_ITEM_KEY:-}"
  UI__TASK_COMMAND=()
  while [[ $# -gt 0 && "$1" != '--' ]]; do
    case "$1" in
      --title) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_service 用法错误：--title 需要文本。'; return 2; }; UI__TASK_TITLE="$2"; shift 2 ;;
      --item-key) [[ $# -ge 2 && -n "$2" ]] || { ui__write_stderr 'ui_service 用法错误：--item-key 需要非空值。'; return 2; }; UI__TASK_ITEM_KEY="$2"; shift 2 ;;
      --sensitive) UI__TASK_SENSITIVE=true; shift ;;
      *) ui__write_stderr 'ui_service 用法错误：支持 --title、--item-key、--sensitive、--。'; return 2 ;;
    esac
  done
  [[ "${1:-}" == '--' && $# -gt 1 ]] || { ui__write_stderr 'ui_service 用法错误：必须在 -- 后提供命令。'; return 2; }
  shift
  [[ -n "$UI__TASK_TITLE" ]] || { ui__write_stderr 'ui_service 用法错误：必须提供 --title。'; return 2; }
  UI__TASK_COMMAND=("$@")
}

# 解析 ui_task_skip 的标题、跳过原因和业务项标识。
# 参数：接受 `--title`、`--reason` 和可选的 `--item-key`。
# 返回：参数合法时返回 0，否则通过 stderr 报错并返回 2。
ui__task_skip_parse() {
  UI__TASK_TITLE=''
  UI__TASK_REASON=''
  UI__TASK_ITEM_KEY="${SCHEMX_UI_GROUP_ITEM_KEY:-}"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_task_skip 用法错误：--title 需要文本。'; return 2; }; UI__TASK_TITLE="$2"; shift 2 ;;
      --reason) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_task_skip 用法错误：--reason 需要文本。'; return 2; }; UI__TASK_REASON="$2"; shift 2 ;;
      --item-key) [[ $# -ge 2 && -n "$2" ]] || { ui__write_stderr 'ui_task_skip 用法错误：--item-key 需要非空值。'; return 2; }; UI__TASK_ITEM_KEY="$2"; shift 2 ;;
      *) ui__write_stderr 'ui_task_skip 用法错误：支持 --title、--reason、--item-key。'; return 2 ;;
    esac
  done
  [[ -n "$UI__TASK_TITLE" && -n "$UI__TASK_REASON" ]] || { ui__write_stderr 'ui_task_skip 用法错误：必须提供 --title 和 --reason。'; return 2; }
}
