#!/usr/bin/env bash

# Clack 内部桥接；只接受 ui_prompt 解析后的结构，不作为业务 API 暴露。

set -o pipefail

_ui_clack_module="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/clack.mjs"

_ui_clack_options_payload() {
  local kind="$1" message="$2" payload="$3"
  shift 3
  jq -n --arg kind "$kind" --arg message "$message" --args '
    {kind:$kind,message:$message,options:($ARGS.positional | map(split(":::") | {value:.[0],label:.[1]}))}
  ' "$@" > "$payload"
}

_ui_clack_group_payload() {
  local message="$1" payload="$2"
  shift 2
  jq -n --arg message "$message" --args '
    ($ARGS.positional | map(split(":::"))) as $entries
    | ($entries | map(select(.[0] == "group") | {key:.[1],value:.[2]}) | from_entries) as $groups
    | (reduce $entries[] as $entry ({};
        if $entry[0] == "group" then .[$entry[2]] = []
        else .[$groups[$entry[0]]] += [{value:$entry[1],label:$entry[2]}]
        end)) as $options
    | {kind:"groupMultiselect",message:$message,options:$options}
  ' "$@" > "$payload"
}

_ui_clack_input_payload() {
  jq -n --arg message "$1" --arg placeholder "$2" '{kind:"input",message:$message,placeholder:$placeholder}' > "$3"
}

_ui_clack_confirm_payload() {
  jq -n --arg message "$1" '{kind:"confirm",message:$message}' > "$2"
}

_ui_clack_invoke() {
  local payload="$1" result="$2" code status message
  if ( : < /dev/tty ) 2>/dev/null && ( : > /dev/tty ) 2>/dev/null; then
    node "$_ui_clack_module" "$payload" "$result" < /dev/tty >&2 2>&2
    code=$?
  elif [[ -t 0 && -t 2 ]]; then
    # 某些终端封装允许读写当前 stdin/stderr，但不允许直接打开 /dev/tty；
    # 将 Clack 的视觉输出固定送到 stderr，避免被 ui_prompt 的 stdout 捕获。
    node "$_ui_clack_module" "$payload" "$result" <&0 >&2 2>&2
    code=$?
  else
    node "$_ui_clack_module" "$payload" "$result"
    code=$?
  fi
  if [[ "$code" -ne 0 ]]; then
    ui_status error "Clack 交互进程异常退出：${code}"
    return "$code"
  fi
  status="$(jq -r '.status // "error"' "$result")" || {
    ui_status error '无法读取 Clack 交互结果。'
    return 1
  }
  case "$status" in
    ok) jq -r '.value | if type == "array" then .[] else tostring end' "$result" ;;
    cancelled) return 130 ;;
    error)
      message="$(jq -r '.message // "未知错误"' "$result")"
      ui_status error "Clack 交互失败：${message}"
      return 1
      ;;
    *) ui_status error "未知的 Clack 交互状态：${status}"; return 1 ;;
  esac
}

_ui_prompt_clack() {
  local kind="$1" message="$2" payload result code
  shift 2
  payload="$(mktemp "${TMPDIR:-/tmp}/schemx-clack-payload.XXXXXX")" || return 1
  result="$(mktemp "${TMPDIR:-/tmp}/schemx-clack-result.XXXXXX")" || { rm -f "$payload"; return 1; }
  case "$kind" in
    select | multiselect) _ui_clack_options_payload "$kind" "$message" "$payload" "$@" ;;
    group-multiselect) _ui_clack_group_payload "$message" "$payload" "$@" ;;
    input) _ui_clack_input_payload "$message" "$1" "$payload" ;;
    confirm) _ui_clack_confirm_payload "$message" "$payload" ;;
    *) ui_status error "未知交互类型：${kind}"; rm -f "$payload" "$result"; return 2 ;;
  esac
  _ui_clack_invoke "$payload" "$result"
  code=$?
  rm -f "$payload" "$result"
  return "$code"
}
