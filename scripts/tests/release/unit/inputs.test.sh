#!/usr/bin/env bash

set -euo pipefail

# 覆盖交互输入适配器的多选归一化与版本动作分派，不启动真实 Gum。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../../../.." && pwd)"
source "$root_dir/scripts/workflow/domains/release/targets.sh"
source "$root_dir/scripts/workflow/domains/release/versions.sh"
source "$root_dir/scripts/workflow/domains/release/inputs.sh"

assert_equals() {
  local actual="$1"
  local expected="$2"
  [[ "$actual" == "$expected" ]] || {
    printf '断言失败：期望 %s，实际 %s\n' "$expected" "$actual" >&2
    exit 1
  }
}

assert_contains() {
  local actual="$1"
  local expected="$2"

  [[ "$actual" == *"$expected"* ]] || {
    printf '断言失败：期望输出包含 %s，实际为 %s\n' "$expected" "$actual" >&2
    exit 1
  }
}

assert_not_contains() {
  local actual="$1"
  local expected="$2"

  [[ "$actual" != *"$expected"* ]] || {
    printf '断言失败：输出不应包含 %s，实际为 %s\n' "$expected" "$actual" >&2
    exit 1
  }
}

ui_status() { :; }

assert_equals "$(release_select_target 'vue,core')" 'core,vue'
assert_equals "$(release_target_summary 'vue,core')" '@schemx/core、@schemx/vue'
assert_equals "$(release_target_summary 'vite-plugin-realpath-fallback,core')" '@schemx/core、@schemx/vite-plugin-realpath-fallback'
assert_equals "$(release_channel_summary beta)" 'beta · 面向公开测试'
assert_equals "$(release_version_action_summary 1.0.0)" '1.0.0 · 指定版本基线'

output="$(
  ui_prompt() { printf 'vue\ncore\n'; }
  release_select_target
)"
assert_equals "$output" 'core,vue'

prompt_options_file="$(mktemp)"
output="$(
  ui_prompt() {
    printf '%s\n' "$@" >"$prompt_options_file"
    printf 'core\n'
  }
  release_select_target
)"
assert_equals "$output" 'core'
assert_contains "$(<"$prompt_options_file")" 'group-multiselect'
assert_contains "$(<"$prompt_options_file")" '--group'
assert_contains "$(<"$prompt_options_file")" 'Packages'
assert_contains "$(<"$prompt_options_file")" 'Plugins'
assert_contains "$(<"$prompt_options_file")" '@schemx/vite-plugin-realpath-fallback · plugins/vite-plugin-realpath-fallback'
assert_not_contains "$(<"$prompt_options_file")" '@plugins/inject-style-css'
rm -f "$prompt_options_file"

output="$(
  ui_prompt() {
    if [[ "$1" == select ]]; then
      printf 'custom'
    elif [[ "$1" == input ]]; then
      printf '1.0.0'
    fi
  }
  release_select_version_action beta
)"
assert_equals "$output" '1.0.0'

if release_select_version_action beta current >/dev/null 2>&1; then
  printf '断言失败：预发布通道不应接受 current。\n' >&2
  exit 1
fi

printf 'inputs.test.sh: 通过\n'
