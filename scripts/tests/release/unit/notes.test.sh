#!/usr/bin/env bash

set -euo pipefail

# 验证新 Release notes 模块会以固定分类生成 Markdown，不依赖旧生成脚本。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../../../.." && pwd)"
source "$root_dir/scripts/workflow/domains/release/notes.sh"

output_file="$(mktemp)"
fixture_root="$(mktemp -d)"
trap 'rm -f "$output_file"; rm -rf "$fixture_root"' EXIT

git() {
  if [[ "$1" == 'tag' ]]; then
    printf '%s\n' '@schemx/core@0.9.0'
    return
  fi
  if [[ "$1" == 'log' ]]; then
    printf '%s\n' 'feat(core): 添加发布计划' 'fix(core): 修复版本计算' 'style: 格式化输出'
    return
  fi
  return 2
}

notes_write_release_notes "$fixture_root" core '@schemx/core' 1.0.0 '@schemx/core@1.0.0' HEAD "$output_file"
notes="$(<"$output_file")"

[[ "$notes" == *'## @schemx/core@1.0.0'* ]]
[[ "$notes" == *'### Features'* ]]
[[ "$notes" == *'### Fixes'* ]]
[[ "$notes" == *'### Other'* ]]

printf 'notes.test.sh: 通过\n'
