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
  bash scripts/workflow.sh build [target]

target：all、packages/core、plugins/<name>、examples/<name>，或以英文逗号分隔的多个目标
USAGE
}

build_main() {
  local requested_target="${1:-}"
  local records
  local scope directory package_name script_name
  local count=0

  [[ $# -le 1 ]] || { build_usage; return 2; }
  case "$requested_target" in
    -h | --help | help)
      build_usage
      return
      ;;
  esac
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
  while IFS=$'\t' read -r scope directory package_name script_name; do
    [[ -n "$package_name" ]] || continue
    ((count += 1))
    workspace_build_run_target "$scope" "$directory" "$package_name" "$script_name" || {
      local exit_code=$?
      ui_flow_end failed "构建失败：${package_name}。"
      return "$exit_code"
    }
  done <<< "$records"
  ui_flow_end success "构建完成：共执行 ${count} 个目标。"
}

build_main "$@"
