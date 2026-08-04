#!/usr/bin/env bash

set -euo pipefail

# 验证 build 的目标规则与 Turborepo / build:h5 执行分流。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../.." && pwd)"
source "$root_dir/scripts/lib/ui.sh"
source "$root_dir/scripts/modules/workspace/targets.sh"
source "$root_dir/scripts/modules/workspace/build.sh"

records="$(CI=true SCHEMX_WORKFLOW_TARGETS=packages/core workspace_build_select_targets "$root_dir")"
[[ "$records" == $'packages\tcore\t@schemx/core\tbuild' ]]

turbo_command="$(
  ui_task() { printf '%s\n' "$*"; }
  workspace_build_run_target '@schemx/core' build
)"
[[ "$turbo_command" == *'--title 构建 @schemx/core --log live -- pnpm exec turbo run build --filter=@schemx/core'* ]]

h5_command="$(
  ui_task() { printf '%s\n' "$*"; }
  workspace_build_run_target 'uni-preset-vue' build:h5
)"
[[ "$h5_command" == *'--title 构建 uni-preset-vue --log live -- pnpm --filter uni-preset-vue run build:h5'* ]]

if workspace_build_run_target '@schemx/core' unexpected >/dev/null 2>&1; then
  printf '断言失败：未知构建 script 不应执行。\n' >&2
  exit 1
fi

printf 'build.test.sh: 通过\n'
