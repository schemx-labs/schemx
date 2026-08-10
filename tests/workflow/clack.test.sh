#!/usr/bin/env bash

set -euo pipefail

# 验证 Shell → Clack 的 JSON 协议，不依赖已安装的 @clack/prompts。

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../.." && pwd)"
source "$root_dir/scripts/workflow/ui/api.sh"

node -e 'import("@clack/prompts").then((module) => { if (typeof module.select !== "function" || typeof module.groupMultiselect !== "function") process.exit(1) })'

payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT

ui__clack_options_payload select '选择发布通道' "$payload_file" \
  '{"value":"beta","label":"beta · 公开测试"}' \
  '{"value":"latest","label":"latest"}'
[[ "$(jq -r '.kind' "$payload_file")" == 'select' ]]
[[ "$(jq -r '.message' "$payload_file")" == '选择发布通道' ]]
[[ "$(jq -r '.options[0].label' "$payload_file")" == 'beta · 公开测试' ]]
[[ "$(jq -r '.options[0].value' "$payload_file")" == 'beta' ]]
[[ "$(jq -r '.options[1].value' "$payload_file")" == 'latest' ]]

ui__clack_input_payload '输入版本' '例如 1.0.0' "$payload_file"
[[ "$(jq -r '.kind' "$payload_file")" == 'input' ]]
[[ "$(jq -r '.placeholder' "$payload_file")" == '例如 1.0.0' ]]

ui__clack_confirm_payload '确认发布？' "$payload_file"
[[ "$(jq -r '.kind' "$payload_file")" == 'confirm' ]]
[[ "$(jq -r '.message' "$payload_file")" == '确认发布？' ]]

ui__clack_group_payload '选择工作区目标' "$payload_file" \
  '{"kind":"group","id":"packages","label":"Packages"}' \
  '{"kind":"option","group":"packages","value":"packages/core","label":"core"}' \
  '{"kind":"option","group":"packages","value":"packages/vue","label":"vue"}' \
  '{"kind":"group","id":"plugins","label":"Plugins"}' \
  '{"kind":"option","group":"plugins","value":"plugins/vite","label":"vite"}'
[[ "$(jq -r '.kind' "$payload_file")" == 'groupMultiselect' ]]
[[ "$(jq -r '.options.packages[0].value' "$payload_file")" == 'packages/core' ]]
[[ "$(jq -r '.options.packages[1].label' "$payload_file")" == 'vue' ]]
[[ "$(jq -r '.options.plugins[0].value' "$payload_file")" == 'plugins/vite' ]]

printf 'clack.test.sh: 通过\n'
