#!/usr/bin/env bash

# 可选 JSONL UI 事件流；事件文件独立于人类 UI 与命令原始日志。

set -o pipefail

# 校验并准备可选的 JSONL UI 事件文件。
# 参数：无显式参数，路径从 SCHEMX_UI_EVENTS_FILE 读取。
# 返回：未配置事件文件或准备成功时返回 0；路径不可写或创建失败返回 2。
ui__events_prepare() {
  local file="${SCHEMX_UI_EVENTS_FILE:-}"
  _UI_EVENTS_FILE=''
  [[ -n "$file" ]] || return 0
  if [[ -e "$file" ]]; then
    [[ -w "$file" ]] || { ui__write_stderr "UI 事件文件不可写：${file}"; return 2; }
  else
    : >> "$file" 2>/dev/null || { ui__write_stderr "无法创建 UI 事件文件：${file}"; return 2; }
  fi
  _UI_EVENTS_FILE="$file"
}

# 将一个带 schema、runId、flowId、groupId 和时间戳的 UI 生命周期事件追加到事件文件。
# 参数：$1 为事件名，$2 为 JSON payload（省略时使用空对象）。
# 返回：事件未启用时返回 0；JSON 编码或写入失败时返回非 0。
ui__event() {
  local event="$1"
  local payload="${2:-}"
  [[ -n "$payload" ]] || payload='{}'
  ui__ensure_run_id || return
  ui__events_prepare || return
  [[ -n "${_UI_EVENTS_FILE:-}" ]] || return 0
  local record
  record="$(jq -cn \
    --arg schema 'schemx.ui/v2' \
    --arg runId "${SCHEMX_UI_RUN_ID:-}" \
    --arg flowId "${SCHEMX_UI_FLOW_ID:-}" \
    --arg groupId "${SCHEMX_UI_GROUP_ID:-}" \
    --arg correlationId "${SCHEMX_UI_CORRELATION_ID:-}" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg event "$event" \
    --argjson payload "$payload" \
    '{schema:$schema,runId:(if $runId == "" then null else $runId end),flowId:(if $flowId == "" then null else $flowId end),groupId:(if $groupId == "" then null else $groupId end),correlationId:(if $correlationId == "" then null else $correlationId end),timestamp:$timestamp,event:$event,payload:$payload}')" || {
      ui__write_stderr "无法编码 UI 事件：${event}"
      return 2
    }
  printf '%s\n' "$record" >> "$_UI_EVENTS_FILE"
}
