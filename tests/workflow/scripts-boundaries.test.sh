#!/usr/bin/env bash

set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../.." && pwd)"

legacy_ui_pattern='(^|[^[:alnum:]])_''ui_'
if rg -n -g '*.sh' -- "$legacy_ui_pattern" "$root_dir/scripts"; then
  printf '断言失败：scripts 中仍存在旧式 UI 私有函数命名。\n' >&2
  exit 1
fi
if rg -n -g '*.sh' -- '(^|[^[:alnum:]])(ui__|workspace__|release__|packages__)' "$root_dir/scripts/workflow/commands"; then
  printf '断言失败：commands 不得调用私有函数。\n' >&2
  exit 1
fi
if rg -n -g '*.sh' -- 'ui__' "$root_dir/scripts/workflow/domains" "$root_dir/scripts/workflow/shared"; then
  printf '断言失败：领域与共享模块不得调用 UI 私有函数。\n' >&2
  exit 1
fi
old_script_dirs='lib|modules'
if rg -n --glob '*.sh' -- "scripts/($old_script_dirs)" "$root_dir/scripts" "$root_dir/tests"; then
  printf '断言失败：仍引用旧 scripts 目录路径。\n' >&2
  exit 1
fi

printf 'scripts-boundaries.test.sh: 通过\n'
