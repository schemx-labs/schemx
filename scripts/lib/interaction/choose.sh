#!/usr/bin/env bash

# 统一交互 API：选择、输入和确认的返回值写入 stdout，反馈写入 stderr/TTY。

set -o pipefail

ui_prompt() {
  local kind="$1"
  shift || true
  local message=''
  local placeholder=''
  local -a options=()
  local -a groups=()
  local value
  local exit_code

  case "$kind" in
    select | multiselect)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) message="${2:-}"; shift 2 ;;
          --option) [[ $# -ge 3 ]] || { _ui_write_stderr 'ui_prompt 用法错误：--option 需要 value 和 label。'; return 2; }; options+=("$2:::$3"); shift 3 ;;
          *) _ui_write_stderr "ui_prompt ${kind} 用法错误：支持 --message、--option。"; return 2 ;;
        esac
      done
      ;;
    group-multiselect)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) message="${2:-}"; shift 2 ;;
          --group) [[ $# -ge 3 ]] || { _ui_write_stderr 'ui_prompt 用法错误：--group 需要 id 和 label。'; return 2; }; groups+=("group:::${2}:::${3}"); shift 3 ;;
          --option) [[ $# -ge 4 ]] || { _ui_write_stderr 'ui_prompt 用法错误：--option 需要 group、value 和 label。'; return 2; }; groups+=("${2}:::${3}:::${4}"); shift 4 ;;
          *) _ui_write_stderr 'ui_prompt group-multiselect 用法错误：支持 --message、--group、--option。'; return 2 ;;
        esac
      done
      ;;
    input)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) message="${2:-}"; shift 2 ;;
          --placeholder) placeholder="${2:-}"; shift 2 ;;
          *) _ui_write_stderr 'ui_prompt input 用法错误：支持 --message、--placeholder。'; return 2 ;;
        esac
      done
      ;;
    confirm)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) message="${2:-}"; shift 2 ;;
          *) _ui_write_stderr 'ui_prompt confirm 用法错误：支持 --message。'; return 2 ;;
        esac
      done
      ;;
    *) _ui_write_stderr "未知交互类型：${kind}"; return 2 ;;
  esac

  [[ -n "$message" ]] || { _ui_write_stderr 'ui_prompt 用法错误：必须提供 --message。'; return 2; }
  if [[ "$kind" == input && -z "$placeholder" ]]; then
    placeholder='请输入内容'
  fi
  if [[ "$kind" == select || "$kind" == multiselect ]]; then
    [[ "${#options[@]}" -gt 0 ]] || { _ui_write_stderr 'ui_prompt 用法错误：至少需要一个 --option。'; return 2; }
  fi
  if [[ "$kind" == group-multiselect ]]; then
    [[ "${#groups[@]}" -gt 0 ]] || { _ui_write_stderr 'ui_prompt 用法错误：至少需要一个 --group 或 --option。'; return 2; }
  fi

  if [[ "$kind" == confirm ]] && ! _ui_is_interactive; then
    [[ "${SCHEMX_UI_ASSUME_YES:-}" == true ]] || return 1
    printf 'true\n'
    _ui_event prompt.completed "$(jq -cn --arg kind "$kind" --arg message "$message" --arg value true '{kind:$kind,message:$message,value:($value == "true")}')"
    return
  fi
  if ! _ui_is_interactive; then
    ui_status error "非交互模式无法执行 ${kind}；请通过参数或环境变量提供值。"
    return 2
  fi

  local result
  local has_layout_file=false
  [[ -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" ]] && has_layout_file=true
  _ui_layout_before
  if [[ "$kind" == input ]]; then
    result="$(_ui_prompt_clack input "$message" "$placeholder")"
    exit_code=$?
  elif [[ "$kind" == group-multiselect ]]; then
    result="$(_ui_prompt_clack group-multiselect "$message" "${groups[@]}")"
    exit_code=$?
  elif [[ "$kind" == confirm ]]; then
    result="$(_ui_prompt_clack confirm "$message")"
    exit_code=$?
  else
    result="$(_ui_prompt_clack "$kind" "$message" "${options[@]}")"
    exit_code=$?
  fi
  _ui_layout_mark
  # standalone `ui_prompt` 可能在命令替换子 Shell 中执行；没有流程状态文件时，
  # 留出一个尾部导轨间隔行，确保父 Shell 的下一段输出仍有可见间隔。
  [[ "$has_layout_file" == true ]] || _ui_layout_gap
  if [[ "$exit_code" -eq 130 ]]; then
    _ui_event prompt.cancelled "$(jq -cn --arg kind "$kind" --arg message "$message" '{kind:$kind,message:$message}')"
    return 130
  fi
  [[ "$exit_code" -eq 0 ]] || return "$exit_code"
  printf '%s\n' "$result"
  local value_json
  if [[ "$kind" == multiselect || "$kind" == group-multiselect ]]; then
    value_json="$(printf '%s\n' "$result" | jq -R -s 'split("\n") | map(select(length > 0))')"
  elif [[ "$kind" == confirm ]]; then
    value_json="$(jq -cn --arg value "$result" '$value == "true"')"
  else
    value_json="$(jq -cn --arg value "$result" '$value')"
  fi
  _ui_event prompt.completed "$(jq -cn --arg kind "$kind" --arg message "$message" --argjson value "$value_json" '{kind:$kind,message:$message,value:$value}')"
}
