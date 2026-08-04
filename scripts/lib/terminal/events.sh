#!/usr/bin/env bash

# 可选 JSONL UI 事件流；事件文件独立于人类 UI 与命令原始日志。

set -o pipefail

_ui_events_prepare() {
  local file="${SCHEMX_UI_EVENTS_FILE:-}"
  [[ -n "$file" ]] || return 0
  if [[ -e "$file" ]]; then
    [[ -w "$file" ]] || { _ui_write_stderr "UI 事件文件不可写：${file}"; return 2; }
  else
    : >> "$file" 2>/dev/null || { _ui_write_stderr "无法创建 UI 事件文件：${file}"; return 2; }
  fi
  _UI_EVENTS_FILE="$file"
}

_ui_event() {
  local event="$1"
  local payload="${2:-}"
  [[ -n "$payload" ]] || payload='{}'
  [[ -n "${_UI_EVENTS_FILE:-}" ]] || return 0
  local record
  record="$(jq -cn \
    --arg schema 'schemx.ui/v1' \
    --arg runId "${_UI_FLOW_RUN_ID:-${SCHEMX_UI_RUN_ID:-unknown}}" \
    --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg event "$event" \
    --argjson payload "$payload" \
    '{schema:$schema,runId:$runId,timestamp:$timestamp,event:$event} + $payload')" || {
      _ui_write_stderr "无法编码 UI 事件：${event}"
      return 2
    }
  printf '%s\n' "$record" >> "$_UI_EVENTS_FILE"
}
