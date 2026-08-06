#!/usr/bin/env bash

# 任务与服务公共 API。

set -o pipefail

_ui_timestamp() {
  perl -MTime::HiRes=time -e 'printf "%.6f", time'
}

_ui_elapsed_seconds() {
  local started_at="$1"
  perl -MTime::HiRes=time -e 'printf "%.2f", time - $ARGV[0]' "$started_at"
}

ui_task() {
  local title=''
  local display=''
  local log=live
  while [[ $# -gt 0 && "$1" != '--' ]]; do
    case "$1" in
      --title) title="${2:-}"; shift 2 ;;
      --display) display="${2:-}"; shift 2 ;;
      --log) log="${2:-}"; shift 2 ;;
      *) _ui_write_stderr 'ui_task 用法错误：支持 --title、--display、--log live|capture、--。'; return 2 ;;
    esac
  done
  [[ "${1:-}" == '--' && $# -gt 1 ]] || { _ui_write_stderr 'ui_task 用法错误：必须在 -- 后提供命令。'; return 2; }
  shift
  [[ -n "$title" ]] || { _ui_write_stderr 'ui_task 用法错误：必须提供 --title。'; return 2; }
  [[ "$log" == live || "$log" == capture ]] || { _ui_write_stderr "未知任务日志策略：${log}"; return 2; }
  display="${display:-$(_ui_command_text "$@")}" || return
  _ui_task_start "$title" "$display" || return

  local started_at
  started_at="$(_ui_timestamp)" || return
  local output_file=''
  local exit_code
  local status=success
  if [[ "$log" == capture ]] && _ui_can_spinner; then
    output_file="$(mktemp "${TMPDIR:-/tmp}/schemx-ui-task.XXXXXX")" || { ui_status error "无法创建 ${title} 的日志文件。"; return 1; }
    if gum spin --spinner dot --title "正在执行 ${title}" -- sh -c 'output_file="$1"; shift; "$@" >"$output_file" 2>&1' _ "$output_file" "$@"; then
      exit_code=0
    else
      exit_code=$?
    fi
    [[ -s "$output_file" ]] && _ui_render_output "$(<"$output_file")"
    rm -f "$output_file"
  elif [[ "$log" == live ]] && _ui_can_spinner; then
    if gum spin --spinner dot --title "正在执行 ${title}" --show-output -- "$@"; then
      exit_code=0
    else
      exit_code=$?
    fi
  else
    if "$@"; then exit_code=0; else exit_code=$?; fi
  fi
  [[ "$exit_code" -eq 0 ]] || status=failed
  local elapsed
  elapsed="$(_ui_elapsed_seconds "$started_at")" || return
  _ui_task_finish "$title" "$status" "$exit_code" "$elapsed" || return
  return "$exit_code"
}

ui_service() {
  local title=''
  local display=''
  while [[ $# -gt 0 && "$1" != '--' ]]; do
    case "$1" in
      --title) title="${2:-}"; shift 2 ;;
      --display) display="${2:-}"; shift 2 ;;
      *) _ui_write_stderr 'ui_service 用法错误：支持 --title、--display、--。'; return 2 ;;
    esac
  done
  [[ "${1:-}" == '--' && $# -gt 1 ]] || { _ui_write_stderr 'ui_service 用法错误：必须在 -- 后提供命令。'; return 2; }
  shift
  [[ -n "$title" ]] || { _ui_write_stderr 'ui_service 用法错误：必须提供 --title。'; return 2; }
  display="${display:-$(_ui_command_text "$@")}" || return
  _ui_task_start "$title" "$display" || return
  _ui_render_line note muted '服务正在运行；按 Ctrl+C 停止。'
  local started_at
  started_at="$(_ui_timestamp)" || return
  local exit_code
  if "$@"; then exit_code=0; else exit_code=$?; fi
  local elapsed
  elapsed="$(_ui_elapsed_seconds "$started_at")" || return
  if [[ "$exit_code" -eq 130 ]]; then
    _ui_task_finish "$title" cancelled "$exit_code" "$elapsed" || return
    return 130
  fi
  if [[ "$exit_code" -eq 0 ]]; then
    _ui_task_finish "$title" success "$exit_code" "$elapsed" || return
  else
    _ui_task_finish "$title" failed "$exit_code" "$elapsed" || return
  fi
  return "$exit_code"
}
