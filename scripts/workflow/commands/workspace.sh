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
  bash scripts/workflow.sh <task> [target]

task：build:analyze、check、lint、lint:fix、format、format:check、type-check、test
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

  ui_task --title "${label} ${package_name}" --log live -- pnpm --dir "$scope/$directory" run "$script" || return
}

workspace_run() {
  local task="${1:-}"
  local target="${2:-}"
  local records
  local scope directory package_name script
  local label
  local count=0

  [[ $# -le 2 && -n "$task" ]] || { workspace_usage; return 2; }
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
  while IFS=$'\t' read -r scope directory package_name script; do
    [[ -n "$package_name" ]] || continue
    ((count += 1))
    workspace_run_target "$scope" "$directory" "$package_name" "$script" "$label" || {
      local exit_code=$?
      if [[ "$exit_code" -eq 130 ]]; then
        ui_flow_end cancelled "${label}已取消。"
      else
        ui_flow_end failed "${label}失败：${package_name}。"
      fi
      return "$exit_code"
    }
  done <<< "$records"
  ui_flow_end success "${label}完成：共执行 ${count} 个目标。"
}

workspace_run "$@"
