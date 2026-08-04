#!/usr/bin/env bash

# 任务生命周期内部渲染与事件封装。

set -o pipefail

_ui_task_start() {
  local title="$1"
  local command_text="$2"
  _ui_layout_before
  _ui_render_task_start "$title" "$command_text" || return
  _ui_layout_mark
  _ui_event task.started "$(jq -cn --arg title "$title" --arg command "$command_text" '{title:$title,command:$command}')"
}

_ui_task_finish() {
  local title="$1"
  local status="$2"
  local exit_code="$3"
  local elapsed="$4"
  # 原生命令与 UI 分属不同输出流；补两条导轨间隔行，避免状态贴在日志末尾，
  # 同时将无输出场景限制在最多两条间隔行。
  _ui_layout_native_boundary
  _ui_render_task_finish "$title" "$status" "$exit_code" "$elapsed" || return
  _ui_layout_mark
  _ui_event task.finished "$(jq -cn --arg title "$title" --arg status "$status" --argjson exitCode "$exit_code" --argjson durationSeconds "$elapsed" '{title:$title,status:$status,exitCode:$exitCode,durationSeconds:$durationSeconds}')"
}
