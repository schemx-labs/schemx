#!/usr/bin/env bash

set -euo pipefail

# 验证通用工作流按任务发现目标，并支持非交互环境的显式目标筛选。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../.." && pwd)"
source "$root_dir/scripts/workflow/ui/api.sh"
source "$root_dir/scripts/workflow/domains/workspace/api.sh"

records="$(workspace_discover_task_targets "$root_dir" lint)"
[[ "$records" == *$'packages\tcore\t@schemx/core\tlint'* ]]

selected="$(CI=true SCHEMX_WORKFLOW_TARGETS=packages/core workspace_select_task_targets "$root_dir" lint)"
[[ "$selected" == $'packages\tcore\t@schemx/core\tlint' ]]

tool_records="$(workspace_discover_targets "$root_dir" 'packages:*,plugins:pack:local')"
[[ "$tool_records" == *$'packages\tcore\t@schemx/core\t'* ]]
[[ "$tool_records" == *$'plugins\tvite-plugin-workspace-source\t@schemx/vite-plugin-workspace-source\tpack:local'* ]]

tool_selection="$(CI=true workspace_select_target_identifiers '选择打包目标' "$tool_records")"
[[ "$tool_selection" == 'all' ]]

ui_is_interactive() { return 0; }
ui_prompt() { return 1; }
if workspace_select_target_identifiers '请选择构建目标' "$tool_records" >/dev/null 2>&1; then
  printf '断言失败：交互模式下未选择目标时不应继续。\n' >&2
  exit 1
fi

interactive_selection="$({
  ui_is_interactive() { return 0; }
  ui_prompt() { printf 'packages/core\npackages/validator\n'; }
  workspace_select_target_identifiers '请选择构建目标' "$tool_records"
})"
[[ "$interactive_selection" == 'packages/core,packages/validator' ]]

interactive_records="$({
  ui_is_interactive() { return 0; }
  ui_prompt() { printf 'packages/core\npackages/validator\n'; }
  workspace_select_task_targets "$root_dir" build
})"
[[ "$interactive_records" == *$'packages\tcore\t@schemx/core\tbuild'* ]]
[[ "$interactive_records" == *$'packages\tvalidator\t@schemx/validator\tbuild'* ]]

# 通用 workspace 命令默认首错停止，--keep-going 执行剩余目标并返回首个失败码。
source "$root_dir/scripts/workflow/commands/workspace.sh"
workspace_select_task_targets() {
  printf '%s\n' \
    $'packages\tcore\t@schemx/core\tlint' \
    $'packages\tvue\t@schemx/vue\tlint'
}
ui_flow_begin() { return 0; }
ui_flow_end() { return 0; }
ui_group_begin() { return 0; }
ui_group_end() { return 0; }
ui_note() { return 0; }
ui_summary() { return 0; }
executed_targets=()
ui_task() {
  local item_key=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --item-key) item_key="$2"; shift 2 ;;
      --) break ;;
      *) shift ;;
    esac
  done
  executed_targets+=("$item_key")
  [[ "$item_key" != '@schemx/core' ]] || return 7
}
set +e
workspace_run lint all
fail_fast_code=$?
set -e
[[ "$fail_fast_code" -eq 7 ]]
[[ "${executed_targets[*]}" == '@schemx/core' ]]
executed_targets=()
set +e
workspace_run lint --keep-going all
keep_going_code=$?
set -e
[[ "$keep_going_code" -eq 7 ]]
[[ "${executed_targets[*]}" == '@schemx/core @schemx/vue' ]]

# 即使启用 --keep-going，取消也必须立即停止。
executed_targets=()
ui_task() {
  local item_key=''
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --item-key) item_key="$2"; shift 2 ;;
      --) break ;;
      *) shift ;;
    esac
  done
  executed_targets+=("$item_key")
  return 130
}
set +e
workspace_run lint all --keep-going
cancel_code=$?
set -e
[[ "$cancel_code" -eq 130 ]]
[[ "${executed_targets[*]}" == '@schemx/core' ]]

printf 'workspace-targets.test.sh: 通过\n'
