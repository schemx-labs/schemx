#!/usr/bin/env bash

# 任务生命周期内部渲染与事件封装。

set -o pipefail

# 生成一次 task 生命周期使用的唯一标识。
# 返回：taskId 写入 stdout。
ui__task_id() {
  printf 'task-%s-%s-%s' "$$" "$(perl -MTime::HiRes=time -e 'printf "%.6f", time' | tr . -)" "$RANDOM"
}

# 渲染任务开始状态并记录包含可执行 argv 的 task.started 事件。
# 参数：依次为 taskId、标题、itemKey、是否敏感，后续参数为实际命令 argv。
# 返回：渲染或事件写入成功时返回 0，否则返回错误码。
ui__task_start() {
  local task_id="$1"
  local title="$2"
  local item_key="$3"
  local sensitive="$4"
  shift 4
  local command_text
  local command_argv

  if [[ "$sensitive" == true ]]; then
    command_text='命令已隐藏'
    command_argv='null'
  else
    command_text="$(ui__command_text "$@")" || return
    command_argv="$(jq -cn '$ARGS.positional' --args -- "$@")" || return
  fi
  ui__layout_before_task || return
  ui__render_task_start "$title" "$command_text" || return
  ui__layout_mark
  ui__event task.started "$(jq -cn --arg taskId "$task_id" --arg title "$title" --arg itemKey "$item_key" --arg command "$command_text" --argjson argv "$command_argv" --argjson sensitive "$sensitive" '{taskId:$taskId,title:$title,itemKey:(if $itemKey == "" then null else $itemKey end),command:(if $sensitive then null else $command end),argv:$argv,sensitive:$sensitive}')"
}

# 在原生命令日志与结束状态之间补齐标准间隔，并记录 task.finished 事件。
# 参数：依次为 taskId、标题、itemKey、success/failed/cancelled、退出码和耗时秒数。
# 返回：渲染或事件写入成功时返回 0，否则返回错误码。
ui__task_finish() {
  local task_id="$1"
  local title="$2"
  local item_key="$3"
  local status="$4"
  local exit_code="$5"
  local elapsed="$6"
  # 原生命令与 UI 分属不同输出流；补两条导轨间隔行，避免状态贴在日志末尾，
  # 同时将无输出场景限制在最多两条间隔行。
  ui__layout_native_boundary || return
  ui__render_task_finish "$title" "$status" "$exit_code" "$elapsed" || return
  ui__layout_mark
  ui__group_record_task "$status" || return
  ui__event task.finished "$(jq -cn --arg taskId "$task_id" --arg title "$title" --arg itemKey "$item_key" --arg status "$status" --argjson exitCode "$exit_code" --argjson durationSeconds "$elapsed" '{taskId:$taskId,title:$title,itemKey:(if $itemKey == "" then null else $itemKey end),status:$status,exitCode:$exitCode,durationSeconds:$durationSeconds}')"
}

# 渲染并记录一个无需执行的任务。
# 参数：依次为 taskId、标题、itemKey 和跳过原因。
# 返回：渲染、group 统计和 task.skipped 事件成功时返回 0，否则返回错误码。
ui__task_skip() {
  local task_id="$1"
  local title="$2"
  local item_key="$3"
  local reason="$4"

  ui__layout_before_task || return
  ui__render_task_skip "$title" "$reason" || return
  ui__layout_mark
  ui__group_record_task skipped || return
  ui__event task.skipped "$(jq -cn --arg taskId "$task_id" --arg title "$title" --arg itemKey "$item_key" --arg reason "$reason" '{taskId:$taskId,title:$title,itemKey:(if $itemKey == "" then null else $itemKey end),status:"skipped",reason:$reason}')"
}
