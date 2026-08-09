#!/usr/bin/env bash

# Clack 内部桥接；只接受 ui_prompt 解析后的结构，不作为业务 API 暴露。

set -o pipefail

ui__clack_module="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/clack.mjs"

# 将普通单选或多选参数编码为 Clack 使用的 JSON 请求文件。
# 参数：$1 为交互类型，$2 为提示文本，$3 为输出文件，后续参数为 value:::label 选项。
# 返回：成功写入 JSON 时返回 0，否则返回 jq 的错误码。
ui__clack_options_payload() {
  local kind="$1" message="$2" payload="$3"
  shift 3
  jq -n --arg kind "$kind" --arg message "$message" --args '
    {kind:$kind,message:$message,options:($ARGS.positional | map(split(":::") | {value:.[0],label:.[1]}))}
  ' "$@" > "$payload"
}

# 将分组选择参数编码为 Clack 的分组与选项 JSON 请求文件。
# 参数：$1 为提示文本，$2 为输出文件，后续参数为 group:::id:::label 或 group:::value:::label。
# 返回：成功写入 JSON 时返回 0，否则返回 jq 的错误码。
ui__clack_group_payload() {
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

# 将文本输入参数编码为 Clack 请求文件。
# 参数：$1 为提示文本，$2 为占位文本，$3 为输出文件。
# 返回：成功写入 JSON 时返回 0，否则返回 jq 的错误码。
ui__clack_input_payload() {
  jq -n --arg message "$1" --arg placeholder "$2" '{kind:"input",message:$message,placeholder:$placeholder}' > "$3"
}

# 将确认提示参数编码为 Clack 请求文件。
# 参数：$1 为提示文本，$2 为输出文件。
# 返回：成功写入 JSON 时返回 0，否则返回 jq 的错误码。
ui__clack_confirm_payload() {
  jq -n --arg message "$1" '{kind:"confirm",message:$message}' > "$2"
}

# 在可用终端上启动 Clack，并把结果文件转换为 ui_prompt 的 stdout/退出码契约。
# 参数：$1 为请求 JSON 文件，$2 为结果 JSON 文件。
# 返回：确认结果写入 stdout；用户取消返回 130；交互进程或结果解析失败返回非 0。
ui__clack_invoke() {
  local payload="$1" result="$2" code status message
  if ( : < /dev/tty ) 2>/dev/null && ( : > /dev/tty ) 2>/dev/null; then
    node "$ui__clack_module" "$payload" "$result" < /dev/tty >&2 2>&2
    code=$?
  elif [[ -t 0 && -t 2 ]]; then
    # 某些终端封装允许读写当前 stdin/stderr，但不允许直接打开 /dev/tty；
    # 将 Clack 的视觉输出固定送到 stderr，避免被 ui_prompt 的 stdout 捕获。
    node "$ui__clack_module" "$payload" "$result" <&0 >&2 2>&2
    code=$?
  else
    node "$ui__clack_module" "$payload" "$result"
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

# 创建一次 Clack 交互所需的临时文件，调用桥接进程并负责清理。
# 参数：$1 为交互类型，$2 为提示文本，其余参数为该类型的选项或占位文本。
# 返回：Clack 结果写入 stdout，取消和错误沿用 ui__clack_invoke 的退出码。
ui__prompt_clack() {
  local kind="$1" message="$2" payload result code
  shift 2
  payload="$(mktemp "${TMPDIR:-/tmp}/schemx-clack-payload.XXXXXX")" || return 1
  result="$(mktemp "${TMPDIR:-/tmp}/schemx-clack-result.XXXXXX")" || { rm -f "$payload"; return 1; }
  case "$kind" in
    select | multiselect) ui__clack_options_payload "$kind" "$message" "$payload" "$@" ;;
    group-multiselect) ui__clack_group_payload "$message" "$payload" "$@" ;;
    input) ui__clack_input_payload "$message" "$1" "$payload" ;;
    confirm) ui__clack_confirm_payload "$message" "$payload" ;;
    *) ui_status error "未知交互类型：${kind}"; rm -f "$payload" "$result"; return 2 ;;
  esac
  ui__clack_invoke "$payload" "$result"
  code=$?
  rm -f "$payload" "$result"
  return "$code"
}
