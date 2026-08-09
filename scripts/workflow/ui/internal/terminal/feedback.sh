#!/usr/bin/env bash

# 流程级 UI 公共 API；底层渲染与事件写入均为内部实现。

set -o pipefail

# 开始一个顶层 UI 流程，初始化布局、事件 runId、格式上下文并渲染标题。
# 参数：支持 --domain workspace|tools|release、--title 标题和 --description 描述。
# 返回：初始化和首个 flow.started 事件成功时返回 0，否则返回错误码。
# 备注：解析后的格式会导出给任务子进程，确保其 UI 样式与父流程一致。
ui_flow_begin() {
  local domain='workspace'
  local title=''
  local description=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --domain) domain="${2:-}"; shift 2 ;;
      --title) title="${2:-}"; shift 2 ;;
      --description) description="${2:-}"; shift 2 ;;
      *) ui__write_stderr 'ui_flow_begin 用法错误：支持 --domain、--title、--description。'; return 2 ;;
    esac
  done
  [[ -n "$title" ]] || { ui__write_stderr 'ui_flow_begin 用法错误：必须提供 --title。'; return 2; }
  case "$domain" in workspace|tools|release) ;; *) ui__write_stderr "未知流程域：${domain}"; return 2 ;; esac
  ui__layout_begin_flow || { ui__write_stderr '无法初始化 UI 布局状态。'; return 1; }
  SCHEMX_UI_RESOLVED_FORMAT="$(ui__format)" || { ui__layout_end_flow; return 1; }
  export SCHEMX_UI_RESOLVED_FORMAT
  _UI_FLOW_DOMAIN="$domain"
  _UI_FLOW_TITLE="$title"
  _UI_FLOW_ACTIVE=false
  _UI_FLOW_RUN_ID="${SCHEMX_UI_RUN_ID:-$$-$(date +%s)}"
  export SCHEMX_UI_RUN_ID="$_UI_FLOW_RUN_ID"
  ui__events_prepare || { local event_code=$?; ui__layout_end_flow; return "$event_code"; }
  ui__render_flow_start "$domain" "$title" "$description" || { local render_code=$?; ui__layout_end_flow; return "$render_code"; }
  ui__layout_mark
  ui__event flow.started "$(jq -cn --arg domain "$domain" --arg title "$title" --arg description "$description" '{domain:$domain,title:$title,description:$description}')" || { local event_code=$?; ui__layout_end_flow; return "$event_code"; }
  _UI_FLOW_ACTIVE=true
}

# 在活动流程中渲染一个具有业务语义的步骤分组，并记录 group.started 事件。
# 参数：支持 --title 分组标题和 --description 分组描述。
# 返回：渲染和事件写入成功时返回 0，否则返回错误码。
ui_flow_group() {
  local title=''
  local description=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) title="${2:-}"; shift 2 ;;
      --description) description="${2:-}"; shift 2 ;;
      *) ui__write_stderr 'ui_flow_group 用法错误：支持 --title、--description。'; return 2 ;;
    esac
  done
  [[ -n "$title" ]] || { ui__write_stderr 'ui_flow_group 用法错误：必须提供 --title。'; return 2; }
  ui__layout_before
  ui__render_group "$title" "$description" || return
  ui__layout_mark
  ui__event group.started "$(jq -cn --arg title "$title" --arg description "$description" '{title:$title,description:$description}')"
}

# 在活动流程中输出一条不代表执行结果的上下文说明，并记录 note 事件。
# 参数：任意数量文本参数，会按空格拼接成一条说明。
# 返回：消息非空且渲染、事件写入成功时返回 0，否则返回非 0。
ui_note() {
  local message="$*"
  [[ -n "$message" ]] || return 2
  ui__layout_before
  ui__render_line note muted "$message" || return
  ui__layout_mark
  ui__event note "$(jq -cn --arg message "$message" '{message:$message}')"
}

# 输出一条带 info、success、warning 或 error 语义的状态，并记录 status 事件。
# 参数：$1 为状态级别，后续参数为状态消息。
# 返回：级别合法且渲染、事件写入成功时返回 0，否则返回非 0。
ui_status() {
  local level="$1"
  shift
  local message="$*"
  case "$level" in info|success|warning|error) ;; *) ui__write_stderr "未知状态级别：${level}"; return 2 ;; esac
  ui__layout_before
  case "$level" in info) ui__render_line note muted "$message" ;; success) ui__render_line success success "$message" ;; warning) ui__render_line warning warning "$message" ;; error) ui__render_line error error "$message" ;; esac
  ui__layout_mark
  ui__event status "$(jq -cn --arg level "$level" --arg message "$message" '{level:$level,message:$message}')"
}

# 输出一个带标题、色调和内容的结构化摘要卡片，并记录 summary 事件。
# 参数：支持 --title、--tone neutral|success|warning|error 和 --content。
# 返回：参数合法且渲染、事件写入成功时返回 0，否则返回非 0。
# 备注：适合展示计划、汇总命令等需要区别于普通说明行的最终结果。
ui_summary() {
  local title=''
  local tone=neutral
  local content=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) title="${2:-}"; shift 2 ;;
      --tone) tone="${2:-}"; shift 2 ;;
      --content) content="${2:-}"; shift 2 ;;
      *) ui__write_stderr 'ui_summary 用法错误：支持 --title、--tone、--content。'; return 2 ;;
    esac
  done
  [[ -n "$title" && -n "$content" ]] || { ui__write_stderr 'ui_summary 用法错误：必须提供标题和内容。'; return 2; }
  case "$tone" in neutral|success|warning|error) ;; *) ui__write_stderr "未知摘要色调：${tone}"; return 2 ;; esac
  ui__layout_before
  ui__render_summary "$title" "$tone" "$content" || return
  ui__layout_mark
  ui__event summary "$(jq -cn --arg title "$title" --arg tone "$tone" --arg content "$content" '{title:$title,tone:$tone,content:$content}')"
}

# 结束活动 UI 流程，渲染最终状态、记录 flow.finished 事件并清理布局上下文。
# 参数：$1 为 success、failed 或 cancelled，后续参数为最终摘要消息。
# 返回：流程结束事件写入成功时返回 0，否则返回事件错误码；无活动流程时返回 0。
ui_flow_end() {
  local status="$1"
  shift
  local summary="$*"
  [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] || return 0
  case "$status" in success|failed|cancelled) ;; *) ui__write_stderr "未知流程结束状态：${status}"; return 2 ;; esac
  ui__layout_before
  case "$status" in success) ui__render_line success success "$summary" ;; failed) ui__render_line error error "$summary" ;; cancelled) ui__render_line warning warning "$summary" ;; esac
  ui__layout_mark
  _UI_FLOW_ACTIVE=false
  local event_code=0
  ui__event flow.finished "$(jq -cn --arg status "$status" --arg summary "$summary" '{status:$status,summary:$summary}')" || event_code=$?
  ui__layout_end_flow
  return "$event_code"
}
