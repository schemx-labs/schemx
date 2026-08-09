#!/usr/bin/env bash

# 一次性任务的执行策略。仅供 task/lifecycle.sh 使用。

# 按日志策略执行一次任务，并在可交互终端中选择 spinner、捕获或实时透传输出。
# 参数：$1 为任务标题，$2 为 capture 或 live，后续参数为待执行命令。
# 返回：原生命令的退出码；UI 临时文件创建失败返回 1。
ui__task_execute() {
  local title="$1"
  local log="$2"
  shift 2
  local output_file=''
  local exit_code

  if [[ "$log" == capture ]] && ui__can_spinner; then
    output_file="$(mktemp "${TMPDIR:-/tmp}/schemx-ui-task.XXXXXX")" || { ui_status error "无法创建 ${title} 的日志文件。"; return 1; }
    if gum spin --spinner dot --title "正在执行 ${title}" -- sh -c 'output_file="$1"; shift; "$@" >"$output_file" 2>&1' _ "$output_file" "$@"; then exit_code=0; else exit_code=$?; fi
    [[ -s "$output_file" ]] && ui__render_output "$(<"$output_file")"
  elif [[ "$log" == live ]] && ui__can_spinner; then
    output_file="$(mktemp "${TMPDIR:-/tmp}/schemx-ui-task.XXXXXX")" || { ui_status error "无法创建 ${title} 的日志文件。"; return 1; }
    if gum spin --spinner dot --title "正在执行 ${title}" --show-output -- bash -o pipefail -c 'output_file="$1"; shift; "$@" 2>&1 | tee "$output_file"' _ "$output_file" "$@"; then exit_code=0; else exit_code=$?; fi
    [[ "$exit_code" -ne 0 && -s "$output_file" ]] && ui__render_output "$(<"$output_file")"
  else
    if "$@"; then exit_code=0; else exit_code=$?; fi
  fi
  [[ -n "$output_file" ]] && rm -f "$output_file"
  return "$exit_code"
}
