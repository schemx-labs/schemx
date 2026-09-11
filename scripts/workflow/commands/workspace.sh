#!/usr/bin/env bash

# 通用 workspace 任务命令：统一处理目标选择、Gum 反馈和 pnpm 执行。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$workflow_root"

source "$workflow_root/scripts/workflow/ui/api.sh"
source "$workflow_root/scripts/workflow/domains/workspace/api.sh"

workspace_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh <task> [target] [--keep-going]

task：build:analyze、check、code-check、lint、lint:fix、format、format:check、type-check、test
target：all、packages/core、plugins/<name>、examples/<name>，或以英文逗号分隔的多个目标
USAGE
}

# 每个选中目标直接执行自身 script，任务记录保持与实际包命令一致。
workspace_run_target() {
  local scope="$1"
  local directory="$2"
  local package_name="$3"
  local script="$4"
  local label="$5"
  local progress="${6:-}"
  local title="${label} ${package_name}"

  [[ -z "$progress" ]] || title="[${progress}] ${title}"
  ui_task --title "$title" --item-key "$package_name" --log live -- pnpm --dir "$scope/$directory" run "$script" || return
}

workspace_run() {
  local task="${1:-}"
  shift || true
  local target
  local keep_going
  local records
  local record_lines=()
  local scope directory package_name script
  local label
  local failures=()
  local first_failure=0
  local exit_code
  local index
  local remaining_count
  local summary_content
  local failure_content

  [[ -n "$task" ]] || { workspace_usage; return 2; }
  workspace_parse_batch_arguments "$@" || { workspace_usage; return 2; }
  [[ "$WORKSPACE_BATCH_HELP" != true ]] || { workspace_usage; return 0; }
  target="$WORKSPACE_BATCH_TARGET"
  keep_going="$WORKSPACE_BATCH_KEEP_GOING"
  label="$(workspace_task_label "$task")"
  ui_flow_begin --domain workspace --title "$label" --description '按选中 workspace 目标逐个执行对应 script。' || return
  ui_note '本地终端支持多选；CI 或管道环境默认执行全部符合条件的目标。'
  records="$(workspace_select_task_targets "$workflow_root" "$task" "$target")" || {
    local exit_code=$?
    [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled "${label}目标选择已取消。" || ui_flow_end failed "${label}目标选择失败。"
    return "$exit_code"
  }
  if [[ -z "$records" ]]; then
    ui_status warning "没有目标定义 ${task} script，无需执行。"
    ui_flow_end success "${label}完成：没有可用目标。"
    return 0
  fi
  while IFS= read -r scope; do
    [[ -n "$scope" ]] && record_lines+=("$scope")
  done <<< "$records"
  ui_group_begin --title "执行${label}" --description '按选中目标顺序执行；--keep-going 会在普通失败后继续。' || return
  for index in "${!record_lines[@]}"; do
    IFS=$'\t' read -r scope directory package_name script <<< "${record_lines[$index]}"
    if workspace_run_target "$scope" "$directory" "$package_name" "$script" "$label" "$((index + 1))/${#record_lines[@]}"; then
      continue
    fi
    exit_code=$?
    if [[ "$exit_code" -eq 130 ]]; then
      ui_group_end cancelled "${label}已取消：${package_name}。" || true
      ui_flow_end cancelled "${label}已取消。"
      return 130
    fi
    failures+=("${package_name}（exit ${exit_code}）")
    [[ "$first_failure" -ne 0 ]] || first_failure=$exit_code
    if [[ "$keep_going" != true ]]; then
      remaining_count=$((${#record_lines[@]} - index - 1))
      summary_content="失败：${package_name}（exit ${exit_code}）"
      summary_content+=$'\n'"未执行：${remaining_count} 个目标"
      ui_summary --title "${label}失败" --tone error --content "$summary_content" || return
      ui_group_end failed "${label}失败：${package_name}。" || true
      ui_flow_end failed "${label}失败：${package_name}。"
      return "$exit_code"
    fi
  done
  if [[ "$first_failure" -ne 0 ]]; then
    failure_content="$(printf '%s\n' "${failures[@]}")"
    ui_summary --title "${label}失败项" --tone error --content "$failure_content" || return
    ui_group_end failed "${label}失败：${#failures[@]} 个目标未通过。" || true
    ui_flow_end failed "${label}未全部完成。"
    return "$first_failure"
  fi
  ui_group_end success "${label}完成：共执行 ${#record_lines[@]} 个目标。" || return
  ui_flow_end success "${label}完成：共执行 ${#record_lines[@]} 个目标。"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  workspace_run "$@"
fi
