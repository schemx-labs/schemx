#!/usr/bin/env bash

# 任务生命周期内部渲染与事件封装。

set -o pipefail

# 渲染任务开始状态并记录包含可执行 argv 的 task.started 事件。
# 参数：$1 为任务标题，后续参数为实际命令 argv。
# 返回：渲染或事件写入成功时返回 0，否则返回错误码。
ui__task_start() {
  local title="$1"
  shift
  local command_text
  local command_argv

  command_text="$(ui__command_text "$@")" || return
  command_argv="$(jq -cn '$ARGS.positional' --args -- "$@")" || return
  ui__layout_before_task
  ui__render_task_start "$title" "$command_text" || return
  ui__layout_mark
  ui__event task.started "$(jq -cn --arg title "$title" --arg command "$command_text" --argjson argv "$command_argv" '{title:$title,command:$command,argv:$argv}')"
}

# 在原生命令日志与结束状态之间补齐标准间隔，并记录 task.finished 事件。
# 参数：依次为任务标题、success/failed/cancelled 状态、退出码和耗时秒数。
# 返回：渲染或事件写入成功时返回 0，否则返回错误码。
ui__task_finish() {
  local title="$1"
  local status="$2"
  local exit_code="$3"
  local elapsed="$4"
  # 原生命令与 UI 分属不同输出流；补两条导轨间隔行，避免状态贴在日志末尾，
  # 同时将无输出场景限制在最多两条间隔行。
  ui__layout_native_boundary
  ui__render_task_finish "$title" "$status" "$exit_code" "$elapsed" || return
  ui__layout_mark
  ui__event task.finished "$(jq -cn --arg title "$title" --arg status "$status" --argjson exitCode "$exit_code" --argjson durationSeconds "$elapsed" '{title:$title,status:$status,exitCode:$exitCode,durationSeconds:$durationSeconds}')"
}
