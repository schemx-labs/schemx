#!/usr/bin/env bash

# 统一交互 API：选择、输入和确认的返回值写入 stdout，反馈写入 stderr/TTY。

set -o pipefail

# 统一处理选择、输入和确认交互，并将用户结果写入 stdout。
# 参数：$1 为 select、multiselect、group-multiselect、input 或 confirm；其余参数描述提示文本和选项。
# 返回：成功时输出选择结果并返回 0；取消返回 130；参数、环境或 Clack 错误返回非 0。
# 备注：UI 状态和 JSONL 事件写入 stderr 或事件文件，避免污染调用方的结果读取。
ui_prompt() {
  [[ $# -gt 0 ]] || { ui__write_stderr 'ui_prompt 用法错误：必须提供交互类型。'; return 2; }
  local kind="$1"
  shift
  local message=''
  local placeholder=''
  local -a options=()
  local -a groups=()
  local -a option_values=()
  local -a group_ids=()
  local -a group_labels=()
  local -a option_groups=()
  local value
  local exit_code

  case "$kind" in
    select | multiselect)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_prompt 用法错误：--message 需要文本。'; return 2; }; message="$2"; shift 2 ;;
          --option)
            [[ $# -ge 3 ]] || { ui__write_stderr 'ui_prompt 用法错误：--option 需要 value 和 label。'; return 2; }
            option_values+=("$2")
            options+=("$(jq -cn --arg value "$2" --arg label "$3" '{value:$value,label:$label}')") || return
            shift 3
            ;;
          *) ui__write_stderr "ui_prompt ${kind} 用法错误：支持 --message、--option。"; return 2 ;;
        esac
      done
      ;;
    group-multiselect)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_prompt 用法错误：--message 需要文本。'; return 2; }; message="$2"; shift 2 ;;
          --group)
            [[ $# -ge 3 ]] || { ui__write_stderr 'ui_prompt 用法错误：--group 需要 id 和 label。'; return 2; }
            group_ids+=("$2")
            group_labels+=("$3")
            groups+=("$(jq -cn --arg kind group --arg id "$2" --arg label "$3" '{kind:$kind,id:$id,label:$label}')") || return
            shift 3
            ;;
          --option)
            [[ $# -ge 4 ]] || { ui__write_stderr 'ui_prompt 用法错误：--option 需要 group、value 和 label。'; return 2; }
            option_groups+=("$2")
            option_values+=("$3")
            groups+=("$(jq -cn --arg kind option --arg group "$2" --arg value "$3" --arg label "$4" '{kind:$kind,group:$group,value:$value,label:$label}')") || return
            shift 4
            ;;
          *) ui__write_stderr 'ui_prompt group-multiselect 用法错误：支持 --message、--group、--option。'; return 2 ;;
        esac
      done
      ;;
    input)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_prompt 用法错误：--message 需要文本。'; return 2; }; message="$2"; shift 2 ;;
          --placeholder) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_prompt 用法错误：--placeholder 需要文本。'; return 2; }; placeholder="$2"; shift 2 ;;
          *) ui__write_stderr 'ui_prompt input 用法错误：支持 --message、--placeholder。'; return 2 ;;
        esac
      done
      ;;
    confirm)
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --message) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_prompt 用法错误：--message 需要文本。'; return 2; }; message="$2"; shift 2 ;;
          *) ui__write_stderr 'ui_prompt confirm 用法错误：支持 --message。'; return 2 ;;
        esac
      done
      ;;
    *) ui__write_stderr "未知交互类型：${kind}"; return 2 ;;
  esac

  [[ -n "$message" ]] || { ui__write_stderr 'ui_prompt 用法错误：必须提供 --message。'; return 2; }
  if [[ "$kind" == input && -z "$placeholder" ]]; then
    placeholder='请输入内容'
  fi
  if [[ "$kind" == select || "$kind" == multiselect ]]; then
    [[ "${#options[@]}" -gt 0 ]] || { ui__write_stderr 'ui_prompt 用法错误：至少需要一个 --option。'; return 2; }
  fi
  if [[ "$kind" == group-multiselect ]]; then
    [[ "${#group_ids[@]}" -gt 0 && "${#option_groups[@]}" -gt 0 ]] || { ui__write_stderr 'ui_prompt 用法错误：至少需要一个含选项的 --group。'; return 2; }
  fi
  local index candidate other_index group_id group_has_option value_json
  for ((index = 0; index < ${#option_values[@]}; index += 1)); do
    [[ -n "${option_values[$index]}" ]] || { ui__write_stderr 'ui_prompt 用法错误：option value 不能为空。'; return 2; }
    for ((other_index = 0; other_index < index; other_index += 1)); do
      [[ "${option_values[$index]}" != "${option_values[$other_index]}" ]] || { ui__write_stderr "ui_prompt 用法错误：option value 重复：${option_values[$index]}"; return 2; }
    done
  done
  if [[ "$kind" == group-multiselect ]]; then
    for ((index = 0; index < ${#group_ids[@]}; index += 1)); do
      group_id="${group_ids[$index]}"
      [[ -n "$group_id" ]] || { ui__write_stderr 'ui_prompt 用法错误：group id 不能为空。'; return 2; }
      for ((other_index = 0; other_index < index; other_index += 1)); do
        [[ "$group_id" != "${group_ids[$other_index]}" ]] || { ui__write_stderr "ui_prompt 用法错误：group id 重复：${group_id}"; return 2; }
        [[ "${group_labels[$index]}" != "${group_labels[$other_index]}" ]] || { ui__write_stderr "ui_prompt 用法错误：group label 重复：${group_labels[$index]}"; return 2; }
      done
      group_has_option=false
      for candidate in "${option_groups[@]}"; do
        [[ "$candidate" == "$group_id" ]] && group_has_option=true
      done
      [[ "$group_has_option" == true ]] || { ui__write_stderr "ui_prompt 用法错误：分组 ${group_id} 没有选项。"; return 2; }
    done
    for candidate in "${option_groups[@]}"; do
      group_has_option=false
      for group_id in "${group_ids[@]}"; do
        [[ "$candidate" == "$group_id" ]] && group_has_option=true
      done
      [[ "$group_has_option" == true ]] || { ui__write_stderr "ui_prompt 用法错误：选项引用了不存在的分组：${candidate}"; return 2; }
    done
  fi

  if [[ "$kind" == confirm ]] && ! ui__is_interactive; then
    [[ "${SCHEMX_UI_ASSUME_YES:-}" == true ]] || { ui_status error '非交互确认需要设置 SCHEMX_UI_ASSUME_YES=true。'; return 2; }
    ui__event prompt.completed "$(jq -cn --arg kind "$kind" --arg message "$message" --arg value true '{kind:$kind,message:$message,value:($value == "true")}')"
    return 0
  fi
  if ! ui__is_interactive; then
    ui_status error "非交互模式无法执行 ${kind}；请通过参数或环境变量提供值。"
    return 2
  fi

  local result
  local has_layout_file=false
  [[ -n "${SCHEMX_UI_LAYOUT_STATE_FILE:-}" ]] && has_layout_file=true
  ui__layout_before
  if [[ "$kind" == input ]]; then
    result="$(ui__prompt_clack input "$message" "$placeholder")"
    exit_code=$?
  elif [[ "$kind" == group-multiselect ]]; then
    result="$(ui__prompt_clack group-multiselect "$message" "${groups[@]}")"
    exit_code=$?
  elif [[ "$kind" == confirm ]]; then
    result="$(ui__prompt_clack confirm "$message")"
    exit_code=$?
  else
    result="$(ui__prompt_clack "$kind" "$message" "${options[@]}")"
    exit_code=$?
  fi
  ui__layout_mark
  # standalone `ui_prompt` 可能在命令替换子 Shell 中执行；没有流程状态文件时，
  # 留出一个尾部导轨间隔行，确保父 Shell 的下一段输出仍有可见间隔。
  [[ "$has_layout_file" == true ]] || ui__layout_gap
  if [[ "$exit_code" -eq 130 ]]; then
    ui__event prompt.cancelled "$(jq -cn --arg kind "$kind" --arg message "$message" '{kind:$kind,message:$message}')"
    return 130
  fi
  [[ "$exit_code" -eq 0 ]] || return "$exit_code"
  if [[ "$kind" == confirm ]]; then
    value_json="$(jq -cn --arg value "$result" '$value == "true"')" || return
    ui__event prompt.completed "$(jq -cn --arg kind "$kind" --arg message "$message" --argjson value "$value_json" '{kind:$kind,message:$message,value:$value}')" || return
    [[ "$result" == true ]] && return 0
    return 1
  fi
  printf '%s\n' "$result"
  if [[ "$kind" == multiselect || "$kind" == group-multiselect ]]; then
    value_json="$(printf '%s\n' "$result" | jq -R -s 'split("\n") | map(select(length > 0))')"
  else
    value_json="$(jq -cn --arg value "$result" '$value')"
  fi
  ui__event prompt.completed "$(jq -cn --arg kind "$kind" --arg message "$message" --argjson value "$value_json" '{kind:$kind,message:$message,value:$value}')"
}
