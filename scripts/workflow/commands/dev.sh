#!/usr/bin/env bash

# dev 命令入口：组合共享 UI、目标选择和开发服务启动规则。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$workflow_root"

source "$workflow_root/scripts/workflow/ui/api.sh"
source "$workflow_root/scripts/workflow/domains/workspace/api.sh"
source "$workflow_root/scripts/workflow/domains/workspace/dev.sh"

dev_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh dev [target]

target：examples/vant 或 examples/uniapp-vant；非交互环境必须显式提供
USAGE
}

dev_main() {
  local requested_target="${1:-}"
  local records
  local scope directory package_name script_name
  local count=0

  [[ $# -le 1 ]] || { dev_usage; return 2; }
  case "$requested_target" in
    -h | --help | help)
      dev_usage
      return
      ;;
    -* )
      dev_usage
      return 2
      ;;
  esac
  ui_flow_begin --domain workspace --title '启动开发服务' --description '交互环境选择一个示例项目，持续运行其 dev 或 dev:h5 script。' || return
  ui_note '开发服务器会持续占用当前终端；使用 Ctrl+C 停止。一次只能启动一个目标。'
  records="$(workspace_dev_select_targets "$workflow_root" "$requested_target")" || {
    local exit_code=$?
    [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '开发服务目标选择已取消。' || ui_flow_end failed '开发服务目标选择失败。'
    return "$exit_code"
  }
  if [[ -z "$records" ]]; then
    ui_status warning '没有目标定义 dev 或 dev:h5 script，无需启动。'
    ui_flow_end success '开发服务已结束：没有可用目标。'
    return 0
  fi
  while IFS=$'\t' read -r scope directory package_name script_name; do
    [[ -n "$package_name" ]] || continue
    ((count += 1))
    workspace_dev_run_target "$package_name" "$script_name" || {
      local exit_code=$?
      if [[ "$exit_code" -eq 130 ]]; then
        ui_flow_end cancelled '开发服务已取消。'
      else
        ui_flow_end failed "开发服务失败：${package_name}。"
      fi
      return "$exit_code"
    }
  done <<< "$records"
  ui_flow_end success "开发服务已结束：共处理 ${count} 个目标。"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  dev_main "$@"
fi
