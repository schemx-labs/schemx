#!/usr/bin/env bash

# build 命令入口：组合共享 UI、构建目标选择与直接执行规则。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$workflow_root"

source "$workflow_root/scripts/workflow/ui/api.sh"
source "$workflow_root/scripts/workflow/domains/workspace/api.sh"
source "$workflow_root/scripts/workflow/domains/workspace/build.sh"

build_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh build [target] [--keep-going]

target：all、packages/core、plugins/<name>、examples/<name>，或以英文逗号分隔的多个目标
USAGE
}

build_main() {
  local requested_target
  local keep_going
  local records
  local record_lines=()
  local scope directory package_name script_name
  local failures=()
  local first_failure=0
  local exit_code
  local index
  local remaining_count
  local summary_content
  local failure_content

  workspace_parse_batch_arguments "$@" || { build_usage; return 2; }
  [[ "$WORKSPACE_BATCH_HELP" != true ]] || { build_usage; return 0; }
  requested_target="$WORKSPACE_BATCH_TARGET"
  keep_going="$WORKSPACE_BATCH_KEEP_GOING"
  ui_flow_begin --domain workspace --title '构建' --description '按选中 workspace 目标逐个执行 build script。' || return
  ui_note '本地终端支持按分类多选；CI 或管道环境默认执行全部符合条件的目标。'
  records="$(workspace_build_select_targets "$workflow_root" "$requested_target")" || {
    local exit_code=$?
    [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '构建目标选择已取消。' || ui_flow_end failed '构建目标选择失败。'
    return "$exit_code"
  }
  if [[ -z "$records" ]]; then
    ui_status warning '没有目标定义 build 或 build:h5 script，无需执行。'
    ui_flow_end success '构建完成：没有可执行目标。'
    return 0
  fi
  while IFS= read -r scope; do
    [[ -n "$scope" ]] && record_lines+=("$scope")
  done <<< "$records"
  ui_group_begin --title '执行构建' --description '按选中目标顺序执行；--keep-going 会在普通失败后继续。' || return
  for index in "${!record_lines[@]}"; do
    IFS=$'\t' read -r scope directory package_name script_name <<< "${record_lines[$index]}"
    if workspace_build_run_target "$scope" "$directory" "$package_name" "$script_name" "$((index + 1))/${#record_lines[@]}"; then
      continue
    fi
    exit_code=$?
    if [[ "$exit_code" -eq 130 ]]; then
      ui_group_end cancelled "构建已取消：${package_name}。" || true
      ui_flow_end cancelled '构建已取消。'
      return 130
    fi
    failures+=("${package_name}（exit ${exit_code}）")
    [[ "$first_failure" -ne 0 ]] || first_failure=$exit_code
    if [[ "$keep_going" != true ]]; then
      remaining_count=$((${#record_lines[@]} - index - 1))
      summary_content="失败：${package_name}（exit ${exit_code}）"
      summary_content+=$'\n'"未执行：${remaining_count} 个目标"
      ui_summary --title '构建失败' --tone error --content "$summary_content" || return
      ui_group_end failed "构建失败：${package_name}。" || true
      ui_flow_end failed "构建失败：${package_name}。"
      return "$exit_code"
    fi
  done
  if [[ "$first_failure" -ne 0 ]]; then
    failure_content="$(printf '%s\n' "${failures[@]}")"
    ui_summary --title '构建失败项' --tone error --content "$failure_content" || return
    ui_group_end failed "构建失败：${#failures[@]} 个目标未通过。" || true
    ui_flow_end failed '构建未全部完成。'
    return "$first_failure"
  fi
  ui_group_end success "构建完成：共执行 ${#record_lines[@]} 个目标。" || return
  ui_flow_end success "构建完成：共执行 ${#record_lines[@]} 个目标。"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  build_main "$@"
fi
