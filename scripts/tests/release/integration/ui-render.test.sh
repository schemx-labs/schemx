#!/usr/bin/env bash

set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plan_file="${test_dir}/../fixtures/beta-plan.json"
source "${test_dir}/../../../workflow/domains/release/feedback.sh"

assert_contains() {
  local value="$1"
  local expected="$2"
  if [[ "$value" != *"$expected"* ]]; then
    printf '断言失败：期望输出包含 %q，实际为：%s\n' "$expected" "$value" >&2
    exit 1
  fi
}

output="$(CI=true release_render_plan "$plan_file" 2>&1)"
assert_contains "$output" '通道：beta'
assert_contains "$output" '@schemx/core'
assert_contains "$output" '1.0.0-beta.0'

output="$(CI=true release_render_outcome "$plan_file" 2>&1)"
assert_contains "$output" '发布完成'

printf 'ui-render.test.sh: 通过\n'
