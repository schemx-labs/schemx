#!/usr/bin/env bash

# 无目标或专用工具命令的统一 Shell 包装，复用项目级终端反馈。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$workflow_root"

source "$workflow_root/scripts/workflow/ui/api.sh"
source "$workflow_root/scripts/workflow/domains/workspace/api.sh"

tools_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh <preview|pack-local|check:packages>
USAGE
}

tools_run() {
  local command="$1"
  local title label target='' records=''
  shift

  case "$command" in
    preview) title='本地预览'; label='启动 Vite Preview'; set -- pnpm exec vite preview ;;
    pack-local)
      [[ $# -le 1 ]] || { tools_usage; return 2; }
      title='本地包打包'
      label='生成本地 tarball'
      records="$(workspace_discover_targets "$workflow_root" 'packages:*,plugins:pack:local')"
      ;;
    check:packages)
      ui_flow_begin --domain tools --title '包完整检查' --description '运行包配置与构建产物边界检查。' || return
      ui_task --title '检查 workspace 包配置' --log live -- bash scripts/workflow/commands/packages/check-config.sh || { local exit_code=$?; ui_flow_end failed '包配置检查失败。'; return "$exit_code"; }
      ui_task --title '检查构建产物 external 边界' --log live -- bash scripts/workflow/commands/packages/check-bundle-boundaries.sh || { local exit_code=$?; ui_flow_end failed '构建产物边界检查失败。'; return "$exit_code"; }
      ui_flow_end success '包完整检查完成。'
      return
      ;;
    *) tools_usage; return 2 ;;
  esac
  ui_flow_begin --domain tools --title "$title" --description '该命令已通过项目级工作流统一分派。' || return
  if [[ "$command" == 'pack-local' ]]; then
    target="$(workspace_select_target_identifiers '请选择要本地打包的目标' "$records" "${1:-}")" || {
      local exit_code=$?
      [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '本地打包目标选择已取消。' || ui_flow_end failed '本地打包目标选择失败。'
      return "$exit_code"
    }
    # 聚合脚本只负责展开依赖和逐个派发；任务层必须记录实际包的叶子命令。
    if env "SCHEMX_WORKFLOW_TARGETS=${target}" bash scripts/workflow/commands/packages/local-pack.sh; then
      ui_flow_end success "${title}完成。"
      return
    else
      local exit_code=$?
      ui_flow_end failed "${title}失败。"
      return "$exit_code"
    fi
  fi
  ui_task --title "$label" --log live -- "$@" || { local exit_code=$?; ui_flow_end failed "${title}失败。"; return "$exit_code"; }
  ui_flow_end success "${title}完成。"
}

[[ $# -ge 1 ]] || { tools_usage; exit 2; }
tools_run "$@"
