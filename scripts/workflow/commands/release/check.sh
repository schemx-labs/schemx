#!/usr/bin/env bash

# release check 命令编排：以发布同样的输入冻结计划并执行所有无副作用校验。

release_check() {
  local requested_channel="${1:-}"
  local requested_target="${2:-}"
  local requested_action="${3:-}"
  local keep_going="${4:-false}"
  local channel target version_action
  local plan_file
  local exit_code

  [[ $# -le 4 && ( "$keep_going" == true || "$keep_going" == false ) ]] || {
    release_usage
    return 2
  }
  ui_flow_begin --domain release --title '发布合规检查' --description '复用发布流程的计划和发布前校验，但不执行任何外部写入。' || return
  ui_group_begin --title '发布脚本测试' --description '验证发布流程、交互控件、目标解析与 UI 渲染。' || return
  if release_run_tests; then
    ui_group_end success '发布脚本测试完成。' || return
  else
    exit_code=$?
    ui_group_end failed '发布脚本测试失败。' || true
    ui_flow_end failed '发布合规检查失败：发布脚本测试。'
    return "$exit_code"
  fi
  ui_group_begin --title '检查配置' --description '发布通道和版本动作为单选；发布包支持多选。' || return
  channel="$(release_select_channel "$requested_channel")" || { ui_group_end cancelled '发布检查已取消。'; ui_flow_end cancelled '发布检查已取消。'; return 130; }
  target="$(release_select_target "$requested_target")" || { ui_group_end cancelled '发布检查已取消。'; ui_flow_end cancelled '发布检查已取消。'; return 130; }
  version_action="$(release_select_version_action "$channel" "$requested_action")" || { ui_group_end cancelled '发布检查已取消。'; ui_flow_end cancelled '发布检查已取消。'; return 130; }
  ui_group_end success '发布检查配置完成。' || return
  ui_group_begin --title '生成发布计划' --description '查询 registry 并冻结待发布的版本、Tag 与源码提交。' || return
  plan_file="$(mktemp "${TMPDIR:-/tmp}/schemx-release-check-plan.XXXXXX")" || {
    ui_group_end failed '无法创建发布检查计划文件。'
    ui_flow_end failed '无法创建发布检查计划文件。'
    return 1
  }
  if release_create_plan "$channel" "$target" "$version_action" "$plan_file" \
    && release_render_plan "$plan_file"; then
    ui_group_end success '发布检查计划已冻结。' || return
  else
    exit_code=$?
    ui_group_end failed '发布检查计划生成失败。' || true
    rm -f "$plan_file"
    ui_flow_end failed '发布合规检查失败。'
    return "$exit_code"
  fi
  if release_verify_plan "$plan_file" "$keep_going"; then
    exit_code=0
  else
    exit_code=$?
  fi
  rm -f "$plan_file"
  if [[ "$exit_code" -eq 0 ]]; then
    ui_flow_end success '发布合规检查完成：未执行版本写入、npm 发布、Git 推送或 GitHub Release 创建。'
  else
    ui_flow_end failed '发布合规检查失败。'
  fi
  return "$exit_code"
}
