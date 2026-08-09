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

printf 'workspace-targets.test.sh: 通过\n'
