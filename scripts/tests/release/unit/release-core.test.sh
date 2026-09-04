#!/usr/bin/env bash

set -euo pipefail

# 覆盖目标解析、SemVer 计算与冻结计划契约的纯逻辑测试。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../../../.." && pwd)"
source "$root_dir/scripts/workflow/domains/release/targets.sh"
source "$root_dir/scripts/workflow/domains/release/versions.sh"
source "$root_dir/scripts/workflow/domains/release/plan.sh"
source "$root_dir/scripts/workflow/domains/release/preflight.sh"
source "$root_dir/scripts/workflow/domains/release/publish.sh"

assert_equals() {
  local actual="$1"
  local expected="$2"
  [[ "$actual" == "$expected" ]] || {
    printf '断言失败：期望 %s，实际 %s\n' "$expected" "$actual" >&2
    exit 1
  }
}

assert_equals "$(versions_baseline 0.2.3 major)" '1.0.0'
assert_equals "$(versions_baseline 0.2.3 minor)" '0.3.0'
assert_equals "$(versions_release_version beta 1.0.0 2)" '1.0.0-beta.2'
assert_equals "$(SCHEMX_RELEASE_TIMESTAMP=20260730120000 SCHEMX_RELEASE_SHA=abc1234 versions_release_version dev 1.0.0)" '1.0.0-dev.20260730120000.abc1234'
assert_equals "$(targets_resolve vue,core)" $'core\nvue'
assert_equals "$(targets_resolve all)" $'core\nvalidator\nvant\nvue\nvite-plugin-package-resolution-compat\nvite-plugin-realpath-fallback\nvite-plugin-workspace-source'
assert_equals "$(targets_package_dir vite-plugin-realpath-fallback)" 'plugins/vite-plugin-realpath-fallback'
assert_equals "$(targets_package_name vite-plugin-realpath-fallback)" '@schemx/vite-plugin-realpath-fallback'
assert_equals "$(targets_grouped_options)" $'group:::packages:::Packages\npackages:::core:::@schemx/core · packages/core\npackages:::validator:::@schemx/validator · packages/validator\npackages:::vant:::@schemx/vant · packages/vant\npackages:::vue:::@schemx/vue · packages/vue\ngroup:::plugins:::Plugins\nplugins:::vite-plugin-package-resolution-compat:::@schemx/vite-plugin-package-resolution-compat · plugins/vite-plugin-package-resolution-compat\nplugins:::vite-plugin-realpath-fallback:::@schemx/vite-plugin-realpath-fallback · plugins/vite-plugin-realpath-fallback\nplugins:::vite-plugin-workspace-source:::@schemx/vite-plugin-workspace-source · plugins/vite-plugin-workspace-source'
targets_has_script vite-plugin-realpath-fallback type-check
if targets_has_script vite-plugin-realpath-fallback lint; then
  printf '断言失败：未定义 lint script 的插件不应进入 lint 检查。\n' >&2
  exit 1
fi

ui_can_spinner() { return 1; }
pnpm() {
  printf '%s\n' '["1.0.0-beta.0","1.0.0-beta.2","1.0.0-rc.1"]'
}
assert_equals "$(preflight_next_prerelease_sequence '@schemx/core' 1.0.0 beta)" '3'

spinner_marker="$(mktemp)"
ui_can_spinner() { return 0; }
gum() {
  printf 'spinner\n' >> "$spinner_marker"
  shift
  while [[ $# -gt 0 && "$1" != '--' ]]; do shift; done
  shift
  "$@"
}
assert_equals "$(preflight_next_prerelease_sequence '@schemx/core' 1.0.0 beta)" '3'
[[ -s "$spinner_marker" ]]
rm -f "$spinner_marker"

token_config="$(NPM_TOKEN=test-token preflight_create_npm_token_config)"
[[ -f "$token_config" ]]
[[ "$(<"$token_config")" == *'//registry.npmjs.org/:_authToken=test-token'* ]]
rm -f "$token_config"

publish_arguments_file="$(mktemp)"
preflight_with_npm_token() {
  printf '%s\n' "$@" > "$publish_arguments_file"
}
NPM_OTP=123456 publish_package '/tmp/schemx-core' next
grep -Fxq -- '--otp' "$publish_arguments_file"
grep -Fxq -- '123456' "$publish_arguments_file"
rm -f "$publish_arguments_file"

if versions_baseline 0.2.3 unknown >/dev/null; then
  printf '断言失败：未知版本动作不应生成基线。\n' >&2
  exit 1
fi

plan_file="$(mktemp)"
trap 'rm -f "$plan_file"' EXIT
plan_write "$plan_file" beta core 1.0.0 beta abc1234 'core|@schemx/core|0.2.3|1.0.0|1.0.0-beta.0'

node - "$plan_file" <<'NODE'
const fs = require('node:fs')
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
if (plan.channel !== 'beta' || plan.packages[0].version !== '1.0.0-beta.0' || !plan.prerelease) {
  process.exit(1)
}
NODE

printf 'release-core.test.sh: 通过\n'
