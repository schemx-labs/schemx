#!/usr/bin/env bash

# release publish 命令编排：收集交互输入、冻结计划，再交给执行器处理发布写操作。

release_publish() {
  local requested_channel="${1:-}"
  local requested_target="${2:-}"
  local requested_action="${3:-}"
  local channel target version_action
  local plan_file
  local exit_code

  [[ $# -le 3 ]] || {
    release_usage
    return 2
  }
  ui_flow_begin --domain release --title '发布流程' --description '选择通道、发布包与版本基线后，系统会冻结计划并等待最终确认。' || return
  ui_flow_group --title '交互配置' --description '发布通道和版本动作为单选；发布包支持多选。' || return
  channel="$(release_select_channel "$requested_channel")" || { ui_flow_end cancelled '发布配置已取消。'; return 130; }
  target="$(release_select_target "$requested_target")" || { ui_flow_end cancelled '发布目标配置已取消。'; return 130; }
  version_action="$(release_select_version_action "$channel" "$requested_action")" || { ui_flow_end cancelled '版本配置已取消。'; return 130; }
  ui_flow_group --title '生成发布计划' --description '查询 registry 并冻结各包的版本计划。' || return
  plan_file="$(mktemp "${TMPDIR:-/tmp}/schemx-release-plan.XXXXXX")" || {
    ui_flow_end failed '无法创建发布计划文件。'
    return 1
  }
  if release_create_plan "$channel" "$target" "$version_action" "$plan_file" && release_execute_plan "$plan_file"; then
    exit_code=0
  else
    exit_code=$?
  fi
  rm -f "$plan_file"
  [[ "$exit_code" -eq 0 ]] || { [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '发布流程已取消。' || ui_flow_end failed '发布流程失败。'; }
  return "$exit_code"
}
