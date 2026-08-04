#!/usr/bin/env bash

# 项目级工作流入口。发布与日常 workspace 任务共享同一套 Shell UI 和命令分派方式。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$workflow_root"

workflow_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh <command> [arguments]

workspace command：dev、build、build:analyze、check、lint、lint:fix、format、format:check、type-check、test
tool command：preview、pack-local、check:packages
release command：release <check|pack|publish|plan|dry-run|verify|execute|test> [...]
USAGE
}

# 将用户主动取消统一视为已处理的交互结束，避免 pnpm 将退出码 130 渲染为生命周期错误。
workflow_run() {
  local exit_code

  if "$@"; then
    return 0
  fi
  exit_code=$?
  [[ "$exit_code" -eq 130 ]] && return 0
  return "$exit_code"
}

case "${1:-}" in
  dev)
    shift
    workflow_run bash "$workflow_root/scripts/commands/dev.sh" "$@"
    ;;
  build)
    shift
    workflow_run bash "$workflow_root/scripts/commands/build.sh" "$@"
    ;;
  build:analyze | check | lint | lint:fix | format | format:check | type-check | test)
    command="$1"
    shift
    workflow_run bash "$workflow_root/scripts/commands/workspace.sh" "$command" "$@"
    ;;
  release)
    shift
    workflow_run bash "$workflow_root/scripts/commands/release.sh" "$@"
    ;;
  preview | pack-local | check:packages)
    command="$1"
    shift
    workflow_run bash "$workflow_root/scripts/commands/tools.sh" "$command" "$@"
    ;;
  help | -h | --help | '')
    workflow_usage
    ;;
  *)
    workflow_usage
    exit 2
    ;;
esac
