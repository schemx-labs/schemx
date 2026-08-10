#!/usr/bin/env bash

# 任务公共 API。参数、执行策略和反馈分别位于同目录的独立模块。

set -o pipefail

# 获取高精度的单调时间起点，供任务耗时计算使用。
# 返回：以秒为单位的小数时间戳。
ui__timestamp() {
  perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC -e 'printf "%.6f", clock_gettime(CLOCK_MONOTONIC)'
}

# 计算从给定起点到当前时刻经过的秒数，并保留两位小数。
# 参数：$1 为 ui__timestamp 产生的起点。
# 返回：格式化后的耗时字符串。
ui__elapsed_seconds() {
  local started_at="$1"
  perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC -e 'printf "%.2f", clock_gettime(CLOCK_MONOTONIC) - $ARGV[0]' "$started_at"
}

# 执行一个有明确结束状态的命令，统一渲染命令、日志、耗时和结果事件。
# 参数：接受 `--title`、`--item-key`、`--log live|capture`、`--interactive` 和 `--` 后的命令。
# 返回：原生命令退出码；参数解析、UI 渲染或事件失败时返回对应错误码。
# 备注：该函数是跨领域脚本使用的一次性任务公共 API。
ui_task() {
  ui__task_parse "$@" || return
  local task_id
  local started_at exit_code status=success elapsed
  task_id="$(ui__task_id)" || return
  ui__task_start "$task_id" "$UI__TASK_TITLE" "$UI__TASK_ITEM_KEY" "$UI__TASK_SENSITIVE" "${UI__TASK_COMMAND[@]}" || return
  started_at="$(ui__timestamp)" || return
  if ui__task_execute "$UI__TASK_TITLE" "$UI__TASK_LOG" "$UI__TASK_INTERACTIVE" "${UI__TASK_COMMAND[@]}"; then exit_code=0; else exit_code=$?; fi
  if [[ "$exit_code" -eq 130 ]]; then
    status=cancelled
  elif [[ "$exit_code" -ne 0 ]]; then
    status=failed
  fi
  elapsed="$(ui__elapsed_seconds "$started_at")" || return
  ui__task_finish "$task_id" "$UI__TASK_TITLE" "$UI__TASK_ITEM_KEY" "$status" "$exit_code" "$elapsed" || return
  return "$exit_code"
}

# 展示一个因条件不满足而未执行的任务，并记录 skipped 生命周期事件。
# 参数：接受 `--title`、`--reason` 和可选的 `--item-key`。
# 返回：参数、渲染或事件失败时返回非 0；成功记录跳过时返回 0。
ui_task_skip() {
  ui__task_skip_parse "$@" || return
  local task_id
  task_id="$(ui__task_id)" || return
  ui__task_skip "$task_id" "$UI__TASK_TITLE" "$UI__TASK_ITEM_KEY" "$UI__TASK_REASON"
}

# 执行持续运行的开发服务，并将 Ctrl+C 映射为取消状态。
# 参数：接受 `--title`、`--item-key` 和 `--` 后的服务命令。
# 返回：服务命令退出码；Ctrl+C 返回 130，其他失败沿用原生命令退出码。
# 备注：该函数不会自动重启服务，也不会吞掉服务的标准输出。
ui_service() {
  ui__service_parse "$@" || return
  local task_id
  task_id="$(ui__task_id)" || return
  ui__task_start "$task_id" "$UI__TASK_TITLE" "$UI__TASK_ITEM_KEY" "$UI__TASK_SENSITIVE" "${UI__TASK_COMMAND[@]}" || return
  ui__render_line note muted '服务正在运行；按 Ctrl+C 停止。' || return
  local started_at exit_code elapsed
  started_at="$(ui__timestamp)" || return
  if "${UI__TASK_COMMAND[@]}"; then exit_code=0; else exit_code=$?; fi
  elapsed="$(ui__elapsed_seconds "$started_at")" || return
  if [[ "$exit_code" -eq 130 ]]; then
    ui__task_finish "$task_id" "$UI__TASK_TITLE" "$UI__TASK_ITEM_KEY" cancelled "$exit_code" "$elapsed" || return
    return 130
  fi
  if [[ "$exit_code" -eq 0 ]]; then
    ui__task_finish "$task_id" "$UI__TASK_TITLE" "$UI__TASK_ITEM_KEY" success "$exit_code" "$elapsed" || return
  else
    ui__task_finish "$task_id" "$UI__TASK_TITLE" "$UI__TASK_ITEM_KEY" failed "$exit_code" "$elapsed" || return
  fi
  return "$exit_code"
}
