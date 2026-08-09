#!/usr/bin/env bash

set -euo pipefail

# 验证 dev 的目标规则只接受 dev 与 dev:h5，交互选择使用单选。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../.." && pwd)"
source "$root_dir/scripts/workflow/ui/api.sh"
source "$root_dir/scripts/workflow/domains/workspace/api.sh"
source "$root_dir/scripts/workflow/domains/workspace/dev.sh"

records="$(CI=true SCHEMX_WORKFLOW_TARGETS=examples/uniapp-vant workspace_dev_select_targets "$root_dir")"
[[ "$records" == $'examples\tuniapp-vant\tuni-preset-vue\tdev:h5' ]]

interactive_records="$({
  ui_is_interactive() { return 0; }
  ui_prompt() {
    [[ "$1" == select ]]
    printf 'examples/vant\n'
  }
  workspace_dev_select_targets "$root_dir"
})"
[[ "$interactive_records" == $'examples\tvant\tvant-demo\tdev' ]]

set +e
workspace_dev_select_targets "$root_dir" 'examples/vant,examples/uniapp-vant' >/dev/null 2>/dev/null
selection_code=$?
set -e
[[ "$selection_code" -eq 2 ]]

printf 'dev.test.sh: 通过\n'
