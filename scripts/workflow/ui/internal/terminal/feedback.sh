#!/usr/bin/env bash

# 流程级 UI 公共 API；底层渲染与事件写入均为内部实现。

set -o pipefail

# 当前 flow 内生成 groupId 的单调序号。
_UI_GROUP_SEQUENCE=0
# 当前 Shell 拥有的 group ID 栈。
_UI_GROUP_IDS=()
# 每层 group 的父 group ID。
_UI_GROUP_PARENT_IDS=()
# 每层 group 的标题。
_UI_GROUP_TITLES=()
# 每层 group 的描述。
_UI_GROUP_DESCRIPTIONS=()
# 每层 group 的稳定业务项标识。
_UI_GROUP_ITEM_KEYS=()
# 每层 group 的单调时间起点。
_UI_GROUP_STARTED_AT=()
# 每层 group 的后代任务状态计数 JSON。
_UI_GROUP_TASK_STATS=()
# 每层 group 的后代 group 状态计数 JSON。
_UI_GROUP_CHILD_STATS=()

# 清空当前 Shell 拥有的 group 栈和子进程继承上下文。
ui__group_reset() {
  _UI_GROUP_SEQUENCE=0
  _UI_GROUP_IDS=()
  _UI_GROUP_PARENT_IDS=()
  _UI_GROUP_TITLES=()
  _UI_GROUP_DESCRIPTIONS=()
  _UI_GROUP_ITEM_KEYS=()
  _UI_GROUP_STARTED_AT=()
  _UI_GROUP_TASK_STATS=()
  _UI_GROUP_CHILD_STATS=()
  unset SCHEMX_UI_GROUP_ID SCHEMX_UI_GROUP_DEPTH SCHEMX_UI_GROUP_ITEM_KEY
}

# 返回当前 Shell 拥有的 group 栈深度。
ui__group_stack_size() {
  printf '%s' "${#_UI_GROUP_IDS[@]}"
}

# 根据当前栈顶恢复供子进程继承的 group 上下文。
ui__group_export_current() {
  local size="${#_UI_GROUP_IDS[@]}"
  if [[ "$size" -eq 0 ]]; then
    unset SCHEMX_UI_GROUP_ID SCHEMX_UI_GROUP_DEPTH SCHEMX_UI_GROUP_ITEM_KEY
    return 0
  fi

  local index=$((size - 1))
  SCHEMX_UI_GROUP_ID="${_UI_GROUP_IDS[$index]}"
  SCHEMX_UI_GROUP_DEPTH="$size"
  SCHEMX_UI_GROUP_ITEM_KEY="${_UI_GROUP_ITEM_KEYS[$index]}"
  export SCHEMX_UI_GROUP_ID SCHEMX_UI_GROUP_DEPTH SCHEMX_UI_GROUP_ITEM_KEY
}

# 将一次任务结果累计到所有活动 group 的后代任务计数。
# 参数：$1 为 success、failed、cancelled 或 skipped。
# 返回：所有计数更新成功时返回 0，否则返回 jq 错误码。
ui__group_record_task() {
  local status="$1"
  local index
  local stats

  case "$status" in success|failed|cancelled|skipped) ;; *) return 2 ;; esac
  for ((index = 0; index < ${#_UI_GROUP_IDS[@]}; index += 1)); do
    stats="$(jq -cn --argjson current "${_UI_GROUP_TASK_STATS[$index]}" --arg status "$status" '$current | .total += 1 | .[$status] += 1')" || return
    _UI_GROUP_TASK_STATS[$index]="$stats"
  done
}

# 将一个已结束子 group 的结果累计到所有剩余祖先 group。
# 参数：$1 为 success、failed、cancelled 或 skipped。
# 返回：所有计数更新成功时返回 0，否则返回 jq 错误码。
ui__group_record_child() {
  local status="$1"
  local index
  local stats

  case "$status" in success|failed|cancelled|skipped) ;; *) return 2 ;; esac
  for ((index = 0; index < ${#_UI_GROUP_IDS[@]}; index += 1)); do
    stats="$(jq -cn --argjson current "${_UI_GROUP_CHILD_STATS[$index]}" --arg status "$status" '$current | .total += 1 | .[$status] += 1')" || return
    _UI_GROUP_CHILD_STATS[$index]="$stats"
  done
}

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
      --domain) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_flow_begin 用法错误：--domain 需要值。'; return 2; }; domain="$2"; shift 2 ;;
      --title) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_flow_begin 用法错误：--title 需要文本。'; return 2; }; title="$2"; shift 2 ;;
      --description) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_flow_begin 用法错误：--description 需要文本。'; return 2; }; description="$2"; shift 2 ;;
      *) ui__write_stderr 'ui_flow_begin 用法错误：支持 --domain、--title、--description。'; return 2 ;;
    esac
  done
  [[ -n "$title" ]] || { ui__write_stderr 'ui_flow_begin 用法错误：必须提供 --title。'; return 2; }
  case "$domain" in workspace|tools|release) ;; *) ui__write_stderr "未知流程域：${domain}"; return 2 ;; esac
  ui__layout_begin_flow || return
  ui__flow_install_cleanup_traps
  SCHEMX_UI_RESOLVED_FORMAT="$(ui__format)" || { ui__flow_restore_cleanup_traps; ui__layout_end_flow; return 1; }
  export SCHEMX_UI_RESOLVED_FORMAT
  _UI_FLOW_DOMAIN="$domain"
  _UI_FLOW_TITLE="$title"
  _UI_FLOW_ACTIVE=false
  ui__group_reset
  ui__ensure_run_id || { ui__flow_restore_cleanup_traps; ui__flow_cleanup; return 1; }
  SCHEMX_UI_FLOW_ID="flow-$$-$(perl -MTime::HiRes=time -e 'printf "%.6f", time' | tr . -)-$RANDOM"
  export SCHEMX_UI_FLOW_ID
  _UI_FLOW_RUN_ID="$SCHEMX_UI_RUN_ID"
  ui__render_flow_start "$domain" "$title" "$description" || { local render_code=$?; ui__flow_restore_cleanup_traps; ui__flow_cleanup; return "$render_code"; }
  ui__layout_mark
  ui__event flow.started "$(jq -cn --arg domain "$domain" --arg title "$title" --arg description "$description" '{domain:$domain,title:$title,description:$description}')" || { local event_code=$?; ui__flow_restore_cleanup_traps; ui__flow_cleanup; return "$event_code"; }
  _UI_FLOW_ACTIVE=true
}

# 在活动 flow 中开始一个可嵌套 group，并将其压入当前 Shell 的 LIFO 栈。
# 参数：支持 --title、--description 和可选的 --item-key。
# 返回：group 渲染及 group.started 事件成功时返回 0，否则返回错误码。
ui_group_begin() {
  local title=''
  local description=''
  local item_key=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --title) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_group_begin 用法错误：--title 需要文本。'; return 2; }; title="$2"; shift 2 ;;
      --description) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_group_begin 用法错误：--description 需要文本。'; return 2; }; description="$2"; shift 2 ;;
      --item-key) [[ $# -ge 2 && -n "$2" ]] || { ui__write_stderr 'ui_group_begin 用法错误：--item-key 需要非空值。'; return 2; }; item_key="$2"; shift 2 ;;
      *) ui__write_stderr 'ui_group_begin 用法错误：支持 --title、--description、--item-key。'; return 2 ;;
    esac
  done
  [[ -n "$title" ]] || { ui__write_stderr 'ui_group_begin 用法错误：必须提供 --title。'; return 2; }
  [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] || { ui__write_stderr 'ui_group_begin 必须在活动 UI 流程中调用。'; return 2; }
  ui__layout_before || return

  local index="${#_UI_GROUP_IDS[@]}"
  local depth=$((index + 1))
  local parent_group_id="${SCHEMX_UI_GROUP_ID:-}"
  local inherited_item_key="${SCHEMX_UI_GROUP_ITEM_KEY:-}"
  local started_at
  local group_id

  [[ -n "$item_key" ]] || item_key="$inherited_item_key"
  started_at="$(ui__timestamp)" || return
  ((_UI_GROUP_SEQUENCE += 1))
  group_id="${SCHEMX_UI_FLOW_ID}/group-${_UI_GROUP_SEQUENCE}"
  _UI_GROUP_IDS[$index]="$group_id"
  _UI_GROUP_PARENT_IDS[$index]="$parent_group_id"
  _UI_GROUP_TITLES[$index]="$title"
  _UI_GROUP_DESCRIPTIONS[$index]="$description"
  _UI_GROUP_ITEM_KEYS[$index]="$item_key"
  _UI_GROUP_STARTED_AT[$index]="$started_at"
  _UI_GROUP_TASK_STATS[$index]='{"total":0,"success":0,"failed":0,"cancelled":0,"skipped":0}'
  _UI_GROUP_CHILD_STATS[$index]='{"total":0,"success":0,"failed":0,"cancelled":0,"skipped":0}'
  ui__group_export_current

  ui__render_group_start "$title" "$description" "$depth" || { local render_code=$?; ui__group_pop; return "$render_code"; }
  ui__layout_mark
  ui__event group.started "$(jq -cn --arg groupId "$group_id" --arg parentGroupId "$parent_group_id" --argjson depth "$depth" --arg title "$title" --arg description "$description" --arg itemKey "$item_key" '{groupId:$groupId,parentGroupId:(if $parentGroupId == "" then null else $parentGroupId end),depth:$depth,title:$title,description:$description,itemKey:(if $itemKey == "" then null else $itemKey end)}')" || {
    local event_code=$?
    ui__group_pop
    return "$event_code"
  }
}

# 弹出当前 Shell 的 group 栈顶并恢复父 group 上下文。
ui__group_pop() {
  local size="${#_UI_GROUP_IDS[@]}"
  [[ "$size" -gt 0 ]] || return 2
  local index=$((size - 1))

  unset "_UI_GROUP_IDS[$index]" "_UI_GROUP_PARENT_IDS[$index]" "_UI_GROUP_TITLES[$index]" \
    "_UI_GROUP_DESCRIPTIONS[$index]" "_UI_GROUP_ITEM_KEYS[$index]" "_UI_GROUP_STARTED_AT[$index]" \
    "_UI_GROUP_TASK_STATS[$index]" "_UI_GROUP_CHILD_STATS[$index]"
  ui__group_export_current
}

# 结束 group 栈顶，记录状态、耗时、后代统计和 group.finished 事件。
# 参数：$1 为结束状态，$2 为可选摘要，$3 为是否由 flow 自动收口。
# 返回：渲染、事件和栈恢复均成功时返回 0，否则返回首个错误码。
ui__group_finish() {
  local status="$1"
  local summary="$2"
  local implicit="$3"
  local size="${#_UI_GROUP_IDS[@]}"
  [[ "$size" -gt 0 ]] || { ui__write_stderr 'ui_group_end 用法错误：没有可结束的活动 group。'; return 2; }
  case "$status" in success|failed|cancelled|skipped) ;; *) ui__write_stderr "未知 group 结束状态：${status}"; return 2 ;; esac

  local index=$((size - 1))
  local group_id="${_UI_GROUP_IDS[$index]}"
  local parent_group_id="${_UI_GROUP_PARENT_IDS[$index]}"
  local title="${_UI_GROUP_TITLES[$index]}"
  local description="${_UI_GROUP_DESCRIPTIONS[$index]}"
  local item_key="${_UI_GROUP_ITEM_KEYS[$index]}"
  local task_stats="${_UI_GROUP_TASK_STATS[$index]}"
  local child_stats="${_UI_GROUP_CHILD_STATS[$index]}"
  local elapsed
  local result_code=0
  elapsed="$(ui__elapsed_seconds "${_UI_GROUP_STARTED_AT[$index]}")" || return
  [[ -n "$summary" ]] || summary="$title"

  ui__layout_before || result_code=$?
  if [[ "$result_code" -eq 0 ]]; then
    ui__render_group_finish "$title" "$status" "$summary" "$elapsed" "$size" || result_code=$?
  fi
  ui__layout_mark
  ui__event group.finished "$(jq -cn --arg groupId "$group_id" --arg parentGroupId "$parent_group_id" --argjson depth "$size" --arg title "$title" --arg description "$description" --arg itemKey "$item_key" --arg status "$status" --arg summary "$summary" --argjson durationSeconds "$elapsed" --argjson implicit "$implicit" --argjson tasks "$task_stats" --argjson groups "$child_stats" '{groupId:$groupId,parentGroupId:(if $parentGroupId == "" then null else $parentGroupId end),depth:$depth,title:$title,description:$description,itemKey:(if $itemKey == "" then null else $itemKey end),status:$status,summary:$summary,durationSeconds:$durationSeconds,implicit:$implicit,tasks:$tasks,groups:$groups}')" || {
    local event_code=$?
    [[ "$result_code" -ne 0 ]] || result_code=$event_code
  }
  ui__group_pop || { local pop_code=$?; [[ "$result_code" -ne 0 ]] || result_code=$pop_code; }
  ui__group_record_child "$status" || { local record_code=$?; [[ "$result_code" -ne 0 ]] || result_code=$record_code; }
  return "$result_code"
}

# 显式结束当前 group。
# 参数：$1 为 success、failed、cancelled 或 skipped，后续参数为可选摘要。
# 返回：无活动 flow 或 group、状态非法、渲染或事件失败时返回非 0。
ui_group_end() {
  [[ $# -gt 0 ]] || { ui__write_stderr 'ui_group_end 用法错误：必须提供结束状态。'; return 2; }
  [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] || { ui__write_stderr 'ui_group_end 必须在活动 UI 流程中调用。'; return 2; }
  local status="$1"
  shift
  ui__group_finish "$status" "$*" false
}

# 在一个自动收口的 group 中执行函数或命令，并保留原始退出码。
# 参数：接受 group 的 --title、--description、--item-key，以及 -- 后的命令 argv。
# 返回：命令失败时返回原始退出码；命令成功时返回 group 结束错误码。
ui_group_run() {
  local title=''
  local description=''
  local item_key=''
  while [[ $# -gt 0 && "$1" != '--' ]]; do
    case "$1" in
      --title) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_group_run 用法错误：--title 需要文本。'; return 2; }; title="$2"; shift 2 ;;
      --description) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_group_run 用法错误：--description 需要文本。'; return 2; }; description="$2"; shift 2 ;;
      --item-key) [[ $# -ge 2 && -n "$2" ]] || { ui__write_stderr 'ui_group_run 用法错误：--item-key 需要非空值。'; return 2; }; item_key="$2"; shift 2 ;;
      *) ui__write_stderr 'ui_group_run 用法错误：支持 --title、--description、--item-key、--。'; return 2 ;;
    esac
  done
  [[ -n "$title" && "${1:-}" == '--' && $# -gt 1 ]] || { ui__write_stderr 'ui_group_run 用法错误：必须提供标题和 -- 后的命令。'; return 2; }
  shift

  local begin_arguments=(--title "$title")
  [[ -n "$description" ]] && begin_arguments+=(--description "$description")
  [[ -n "$item_key" ]] && begin_arguments+=(--item-key "$item_key")
  ui_group_begin "${begin_arguments[@]}" || return

  local exit_code
  local status=success
  local end_code=0
  if "$@"; then exit_code=0; else exit_code=$?; fi
  if [[ "$exit_code" -eq 130 ]]; then
    status=cancelled
  elif [[ "$exit_code" -ne 0 ]]; then
    status=failed
  fi
  ui_group_end "$status" "$title" || end_code=$?
  [[ "$exit_code" -ne 0 ]] && return "$exit_code"
  return "$end_code"
}

# 按指定状态自动结束当前 flow 的全部未闭合 group。
# 参数：$1 为 failed 或 cancelled，$2 为统一摘要。
# 返回：所有 group 均结束时返回 0，否则返回首个错误码。
ui__group_unwind() {
  local status="$1"
  local summary="$2"
  local result_code=0
  local group_code
  while [[ "${#_UI_GROUP_IDS[@]}" -gt 0 ]]; do
    ui__group_finish "$status" "$summary" true
    group_code=$?
    [[ "$result_code" -ne 0 || "$group_code" -eq 0 ]] || result_code=$group_code
  done
  return "$result_code"
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
  [[ $# -gt 0 ]] || { ui__write_stderr 'ui_status 用法错误：必须提供状态级别。'; return 2; }
  local level="$1"
  shift
  local message="$*"
  case "$level" in info|success|warning|error) ;; *) ui__write_stderr "未知状态级别：${level}"; return 2 ;; esac
  ui__layout_before
  case "$level" in info) ui__render_line note muted "$message" ;; success) ui__render_line success success "$message" ;; warning) ui__render_line warning warning "$message" ;; error) ui__render_line error error "$message" ;; esac || return
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
      --title) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_summary 用法错误：--title 需要文本。'; return 2; }; title="$2"; shift 2 ;;
      --tone) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_summary 用法错误：--tone 需要值。'; return 2; }; tone="$2"; shift 2 ;;
      --content) [[ $# -ge 2 ]] || { ui__write_stderr 'ui_summary 用法错误：--content 需要文本。'; return 2; }; content="$2"; shift 2 ;;
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

# 为异常退出或信号中断补齐 group 与 flow 结束事件，但不改变进程退出码或 trap。
# 参数：依次为 failed/cancelled、摘要和原始退出码。
# 返回：自动收口、渲染及事件均成功时返回 0，否则返回首个错误码。
ui__flow_finish_implicit() {
  local status="$1"
  local summary="$2"
  local exit_code="$3"
  [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] || return 0
  case "$status" in failed|cancelled) ;; *) return 2 ;; esac

  local result_code=0
  ui__group_unwind "$status" "$summary" || result_code=$?
  ui__layout_before
  case "$status" in
    failed) ui__render_line error error "$summary" ;;
    cancelled) ui__render_line warning warning "$summary" ;;
  esac || { local render_code=$?; [[ "$result_code" -ne 0 ]] || result_code=$render_code; }
  ui__layout_mark
  _UI_FLOW_ACTIVE=false
  ui__event flow.finished "$(jq -cn --arg status "$status" --arg summary "$summary" --argjson exitCode "$exit_code" '{status:$status,summary:$summary,implicit:true,exitCode:$exitCode}')" || {
    local event_code=$?
    [[ "$result_code" -ne 0 ]] || result_code=$event_code
  }
  return "$result_code"
}

# 结束活动 UI 流程，渲染最终状态、记录 flow.finished 事件并清理布局上下文。
# 参数：$1 为 success、failed 或 cancelled，后续参数为最终摘要消息。
# 返回：成功 flow 存在未闭合 group 时返回 2；其他渲染或事件错误沿用底层错误码。
ui_flow_end() {
  [[ $# -gt 0 ]] || { ui__write_stderr 'ui_flow_end 用法错误：必须提供结束状态。'; return 2; }
  local status="$1"
  shift
  local summary="$*"
  [[ "${_UI_FLOW_ACTIVE:-false}" == true ]] || return 0
  case "$status" in success|failed|cancelled) ;; *) ui__write_stderr "未知流程结束状态：${status}"; return 2 ;; esac
  if [[ "$status" == success && "${#_UI_GROUP_IDS[@]}" -gt 0 ]]; then
    ui__write_stderr 'ui_flow_end 用法错误：成功结束 flow 前必须显式结束所有 group。'
    return 2
  fi
  if [[ "$status" != success && "${#_UI_GROUP_IDS[@]}" -gt 0 ]]; then
    ui__group_unwind "$status" "$summary" || return
  fi
  ui__layout_before
  case "$status" in success) ui__render_line success success "$summary" ;; failed) ui__render_line error error "$summary" ;; cancelled) ui__render_line warning warning "$summary" ;; esac || { local render_code=$?; ui__flow_restore_cleanup_traps; ui__flow_cleanup; return "$render_code"; }
  ui__layout_mark
  _UI_FLOW_ACTIVE=false
  local event_code=0
  ui__event flow.finished "$(jq -cn --arg status "$status" --arg summary "$summary" '{status:$status,summary:$summary,implicit:false,exitCode:null}')" || event_code=$?
  ui__flow_restore_cleanup_traps
  ui__flow_cleanup
  return "$event_code"
}
