#!/usr/bin/env bash

# 任务公共 API。参数、执行策略和反馈分别位于同目录的独立模块。

set -o pipefail

# 获取高精度的单调时间起点，供任务耗时计算使用。
# 返回：以秒为单位的小数时间戳。
ui__timestamp() {
  perl -MTime::HiRes=time -e 'printf "%.6f", time'
}

# 计算从给定起点到当前时刻经过的秒数，并保留两位小数。
# 参数：$1 为 ui__timestamp 产生的起点。
# 返回：格式化后的耗时字符串。
ui__elapsed_seconds() {
  local started_at="$1"
  perl -MTime::HiRes=time -e 'printf "%.2f", time - $ARGV[0]' "$started_at"
}

# 执行一个有明确结束状态的命令，统一渲染命令、日志、耗时和结果事件。
# 参数：接受 `--title`、`--log live|capture` 和 `--` 后的命令。
# 返回：原生命令退出码；参数解析、UI 渲染或事件失败时返回对应错误码。
# 备注：该函数是跨领域脚本使用的一次性任务公共 API。
ui_task() {
  ui__task_parse "$@" || return
  ui__task_start "$UI__TASK_TITLE" "${UI__TASK_COMMAND[@]}" || return
  local started_at exit_code status=success elapsed
  started_at="$(ui__timestamp)" || return
  if ui__task_execute "$UI__TASK_TITLE" "$UI__TASK_LOG" "${UI__TASK_COMMAND[@]}"; then exit_code=0; else exit_code=$?; fi
  [[ "$exit_code" -eq 0 ]] || status=failed
  elapsed="$(ui__elapsed_seconds "$started_at")" || return
  ui__task_finish "$UI__TASK_TITLE" "$status" "$exit_code" "$elapsed" || return
  return "$exit_code"
}

# 执行持续运行的开发服务，并将 Ctrl+C 映射为取消状态。
# 参数：接受 `--title` 和 `--` 后的服务命令。
# 返回：服务命令退出码；Ctrl+C 返回 130，其他失败沿用原生命令退出码。
# 备注：该函数不会自动重启服务，也不会吞掉服务的标准输出。
ui_service() {
  ui__service_parse "$@" || return
  ui__task_start "$UI__TASK_TITLE" "${UI__TASK_COMMAND[@]}" || return
  ui__render_line note muted '服务正在运行；按 Ctrl+C 停止。'
  local started_at exit_code elapsed
  started_at="$(ui__timestamp)" || return
  if "${UI__TASK_COMMAND[@]}"; then exit_code=0; else exit_code=$?; fi
  elapsed="$(ui__elapsed_seconds "$started_at")" || return
  if [[ "$exit_code" -eq 130 ]]; then
    ui__task_finish "$UI__TASK_TITLE" cancelled "$exit_code" "$elapsed" || return
    return 130
  fi
  if [[ "$exit_code" -eq 0 ]]; then
    ui__task_finish "$UI__TASK_TITLE" success "$exit_code" "$elapsed" || return
  else
    ui__task_finish "$UI__TASK_TITLE" failed "$exit_code" "$elapsed" || return
  fi
  return "$exit_code"
}
