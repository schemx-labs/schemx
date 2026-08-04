#!/usr/bin/env bash

# 流程级 UI 公共 API；底层渲染与事件写入均为内部实现。

set -o pipefail

ui_flow_begin() {
  local domain='workspace'
  local title=''
  local description=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain) domain="${2:-}"; shift 2 ;;
      --title) title="${2:-}"; shift 2 ;;
      --description) description="${2:-}"; shift 2 ;;
      *) _ui_write_stderr 'ui_flow_begin 用法错误：支持 --domain、--title、--description。'; return 2 ;;
    esac
  done
  [[ -n "$title" ]] || { _ui_write_stderr 'ui_flow_begin 用法错误：必须提供 --title。'; return 2; }
  case "$domain" in workspace|tools|release) ;; *) _ui_write_stderr "未知流程域：${domain}"; return 2 ;; esac
  _ui_layout_begin_flow || { _ui_write_stderr '无法初始化 UI 布局状态。'; return 1; }
  _UI_FLOW_DOMAIN="$domain"
  _UI_FLOW_TITLE="$title"
  _UI_FLOW_ACTIVE=false
  _UI_FLOW_RUN_ID="${SCHEMX_UI_RUN_ID:-$$-$(date +%s)}"
  export SCHEMX_UI_RUN_ID="$_UI_FLOW_RUN_ID"
  _ui_events_prepare || { local event_code=$?; _ui_layout_end_flow; return "$event_code"; }
  _ui_render_flow_start "$domain" "$title" "$description" || { local render_code=$?; _ui_layout_end_flow; return "$render_code"; }
  _ui_layout_mark
  _ui_event flow.started "$(jq -cn --arg domain "$domain" --arg title "$title" --arg description "$description" '{domain:$domain,title:$title,description:$description}')" || { local event_code=$?; _ui_layout_end_flow; return "$event_code"; }
  _UI_FLOW_ACTIVE=true
}

ui_flow_group() {
  local title=''
  local description=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) title="${2:-}"; shift 2 ;;
      --description) description="${2:-}"; shift 2 ;;
      *) _ui_write_stderr 'ui_flow_group 用法错误：支持 --title、--description。'; return 2 ;;
    esac
  done
  [[ -n "$title" ]] || { _ui_write_stderr 'ui_flow_group 用法错误：必须提供 --title。'; return 2; }
  _ui_layout_before
  _ui_render_group "$title" "$description" || return
  _ui_layout_mark
  _ui_event group.started "$(jq -cn --arg title "$title" --arg description "$description" '{title:$title,description:$description}')"
}

ui_note() {
  local message="$*"
  [[ -n "$message" ]] || return 2
  _ui_layout_before
  _ui_render_line note muted "$message" || return
  _ui_layout_mark
  _ui_event note "$(jq -cn --arg message "$message" '{message:$message}')"
}

ui_status() {
  local level="$1"
  shift
  local message="$*"
  case "$level" in info|success|warning|error) ;; *) _ui_write_stderr "未知状态级别：${level}"; return 2 ;; esac
  _ui_layout_before
  case "$level" in info) _ui_render_line note muted "$message" ;; success) _ui_render_line success success "$message" ;; warning) _ui_render_line warning warning "$message" ;; error) _ui_render_line error error "$message" ;; esac
  _ui_layout_mark
  _ui_event status "$(jq -cn --arg level "$level" --arg message "$message" '{level:$level,message:$message}')"
}

ui_summary() {
  local title=''
  local tone=neutral
  local content=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) title="${2:-}"; shift 2 ;;
      --tone) tone="${2:-}"; shift 2 ;;
      --content) content="${2:-}"; shift 2 ;;
      *) _ui_write_stderr 'ui_summary 用法错误：支持 --title、--tone、--content。'; return 2 ;;
    esac
  done
  [[ -n "$title" && -n "$content" ]] || { _ui_write_stderr 'ui_summary 用法错误：必须提供标题和内容。'; return 2; }
  case "$tone" in neutral|success|warning|error) ;; *) _ui_write_stderr "未知摘要色调：${tone}"; return 2 ;; esac
  _ui_layout_before
  _ui_render_summary "$title" "$tone" "$content" || return
  _ui_layout_mark
  _ui_event summary "$(jq -cn --arg title "$title" --arg tone "$tone" --arg content "$content" '{title:$title,tone:$tone,content:$content}')"
}

ui_flow_end() {
  local status="$1"
  shift
  local summary="$*"
  [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] || return 0
  case "$status" in success|failed|cancelled) ;; *) _ui_write_stderr "未知流程结束状态：${status}"; return 2 ;; esac
  _ui_layout_before
  case "$status" in success) _ui_render_line success success "$summary" ;; failed) _ui_render_line error error "$summary" ;; cancelled) _ui_render_line warning warning "$summary" ;; esac
  _ui_layout_mark
  _UI_FLOW_ACTIVE=false
  local event_code=0
  _ui_event flow.finished "$(jq -cn --arg status "$status" --arg summary "$summary" '{status:$status,summary:$summary}')" || event_code=$?
  _ui_layout_end_flow
  return "$event_code"
}
