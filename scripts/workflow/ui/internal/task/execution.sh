#!/usr/bin/env bash

# 一次性任务的执行策略。仅供 task/lifecycle.sh 使用。

# 按日志策略执行一次任务；TTY 直通模式跳过 Spinner 与日志中转。
# 参数：$1 为任务标题，$2 为 capture 或 live，$3 为是否 TTY 直通，后续参数为待执行命令。
# 返回：原生命令的退出码；UI 临时文件创建失败返回 1。
ui__task_execute() {
  local title="$1"
  local log="$2"
  local interactive="$3"
  shift 3
  local output_file=''
  local exit_code

  if [[ "$interactive" == true ]]; then
    if "$@"; then exit_code=0; else exit_code=$?; fi
  elif [[ "$log" == capture ]]; then
    output_file="$(mktemp "${TMPDIR:-/tmp}/schemx-ui-task.XXXXXX")" || { ui_status error "无法创建 ${title} 的日志文件。"; return 1; }
    _UI_TASK_OUTPUT_FILE="$output_file"
    if ui__can_spinner; then
      if gum spin --spinner dot --title "正在执行 ${title}" -- sh -c 'output_file="$1"; shift; "$@" >"$output_file" 2>&1' _ "$output_file" "$@"; then exit_code=0; else exit_code=$?; fi
    else
      if "$@" >"$output_file" 2>&1; then exit_code=0; else exit_code=$?; fi
    fi
    if [[ -s "$output_file" ]]; then
      ui__render_output "$(<"$output_file")" || {
        local render_code=$?
        [[ "$exit_code" -eq 0 ]] && exit_code=$render_code
      }
    fi
  else
    if "$@"; then exit_code=0; else exit_code=$?; fi
  fi
  if [[ -n "$output_file" ]]; then
    rm -f "$output_file"
    unset _UI_TASK_OUTPUT_FILE
  fi
  return "$exit_code"
}
