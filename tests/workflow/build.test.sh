#!/usr/bin/env bash

set -euo pipefail

# 验证 build 的目标规则与直接包级执行。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../.." && pwd)"
source "$root_dir/scripts/workflow/ui/api.sh"
source "$root_dir/scripts/workflow/domains/workspace/api.sh"
source "$root_dir/scripts/workflow/domains/workspace/build.sh"

records="$(CI=true SCHEMX_WORKFLOW_TARGETS=packages/core workspace_build_select_targets "$root_dir")"
[[ "$records" == $'packages\tcore\t@schemx/core\tbuild' ]]

build_command="$(
  ui_task() { printf '%s\n' "$*"; }
  workspace_build_run_target packages core '@schemx/core' build
)"
[[ "$build_command" == *'--title 构建 @schemx/core --item-key @schemx/core --log live -- pnpm --dir packages/core run build'* ]]

h5_command="$(
  ui_task() { printf '%s\n' "$*"; }
  workspace_build_run_target examples uniapp-vant 'uni-preset-vue' build:h5
)"
[[ "$h5_command" == *'--title 构建 uni-preset-vue --item-key uni-preset-vue --log live -- pnpm --dir examples/uniapp-vant run build:h5'* ]]

if workspace_build_run_target packages core '@schemx/core' unexpected >/dev/null 2>&1; then
  printf '断言失败：未知构建 script 不应执行。\n' >&2
  exit 1
fi

# build 的 --keep-going 必须继续执行剩余目标并返回首个失败码。
source "$root_dir/scripts/workflow/commands/build.sh"
workspace_build_select_targets() {
  printf '%s\n' \
    $'packages\tcore\t@schemx/core\tbuild' \
    $'packages\tvue\t@schemx/vue\tbuild'
}
ui_flow_begin() { return 0; }
ui_flow_end() { return 0; }
ui_group_begin() { return 0; }
ui_group_end() { return 0; }
ui_note() { return 0; }
ui_summary() { return 0; }
built_targets=()
workspace_build_run_target() {
  built_targets+=("$3")
  [[ "$3" != '@schemx/core' ]] || return 9
}
set +e
build_main all --keep-going
build_keep_going_code=$?
set -e
[[ "$build_keep_going_code" -eq 9 ]]
[[ "${built_targets[*]}" == '@schemx/core @schemx/vue' ]]

printf 'build.test.sh: 通过\n'
