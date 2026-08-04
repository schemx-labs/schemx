#!/usr/bin/env bash

set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../../../.." && pwd)"
source "$root_dir/scripts/lib/ui.sh"

assert_contains() {
  local value="$1"
  local expected="$2"
  [[ "$value" == *"$expected"* ]] || {
    printf '断言失败：期望输出包含 %q，实际为：%s\n' "$expected" "$value" >&2
    exit 1
  }
}

assert_not_contains() {
  local value="$1"
  local unexpected="$2"
  [[ "$value" != *"$unexpected"* ]] || {
    printf '断言失败：输出不应包含 %q，实际为：%s\n' "$unexpected" "$value" >&2
    exit 1
  }
}

assert_rail_gap_before() {
  local file="$1"
  local marker="$2"
  local gap
  gap="$(awk -v marker="$marker" '
    index($0, marker) {
      print blanks
      found = 1
      exit
    }
    $0 == "│" { blanks += 1; next }
    $0 == "" { blanks = -1; next }
    { blanks = 0 }
    END { if (!found) print -1 }
  ' "$file" | tail -n 1)"
  [[ "$gap" -ge 1 && "$gap" -le 2 ]] || {
    printf '断言失败：%q 前的导轨间隔行数应为 1–2，实际为 %s\n' "$marker" "$gap" >&2
    sed -n l "$file" >&2
    exit 1
  }
}

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/schemx-ui-test.XXXXXX")"
trap 'rm -rf "$temp_dir"' EXIT

plain_stderr="$temp_dir/plain.stderr"
plain_stdout="$temp_dir/plain.stdout"
SCHEMX_UI_FORMAT=plain ui_note '说明文本' >"$plain_stdout" 2>"$plain_stderr"
[[ ! -s "$plain_stdout" ]]
assert_contains "$(<"$plain_stderr")" '[说明] 说明文本'

events_file="$temp_dir/events.jsonl"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$events_file"
  ui_flow_begin --domain workspace --title '构建' --description '说明'
  ui_flow_group --title '质量检查' --description '分组说明'
  ui_note '执行说明'
  ui_status info 'info'
  ui_status success 'ok'
  ui_task --title '成功任务' --log live -- bash -c 'printf 原始输出'
  ui_summary --title '结果摘要' --tone success --content $'第一行\n第二行'
  ui_flow_end success '流程完成'
) >"$plain_stdout" 2>"$plain_stderr"

[[ "$(<"$plain_stdout")" == '原始输出' ]]
plain_output="$(<"$plain_stderr")"
assert_contains "$plain_output" '=== 构建 ==='
assert_contains "$plain_output" '[任务] 成功任务'
assert_contains "$plain_output" '[成功] 流程完成'
assert_not_contains "$plain_output" '阶段'
assert_rail_gap_before "$plain_stderr" '--- 质量检查 ---'
assert_rail_gap_before "$plain_stderr" '[说明] 执行说明'
assert_rail_gap_before "$plain_stderr" '[说明] info'
assert_rail_gap_before "$plain_stderr" '[成功] ok'
assert_rail_gap_before "$plain_stderr" '[任务] 成功任务'
assert_rail_gap_before "$plain_stderr" '[成功] 成功任务'
assert_rail_gap_before "$plain_stderr" '--- 结果摘要 ---'
assert_rail_gap_before "$plain_stderr" '[成功] 流程完成'
if rg -n '^$' "$plain_stderr" >/dev/null; then
  printf '断言失败：UI 组合输出不应出现无导轨的空行。\n' >&2
  sed -n l "$plain_stderr" >&2
  exit 1
fi

event_names=''
while IFS= read -r event_name; do
  event_names+="${event_names:+ }${event_name}"
done < <(jq -r '.event' "$events_file")
[[ "$event_names" == 'flow.started group.started note status status task.started task.finished summary flow.finished' ]]
jq -se 'all(.[]; .schema == "schemx.ui/v1")' "$events_file" >/dev/null
jq -se 'any(.[]; .event == "task.finished" and .status == "success" and .exitCode == 0)' "$events_file" >/dev/null

_ui_is_interactive() { [[ "${_UI_TEST_NONINTERACTIVE:-}" != true ]]; }
_ui_prompt_clack() {
  if [[ "$1" == confirm ]]; then
    printf 'true\n'
  else
    printf 'core\nvue\n'
  fi
}
prompt_events="$temp_dir/prompt-events.jsonl"
prompt_interaction_stderr="$temp_dir/prompt-interaction.stderr"
SCHEMX_UI_EVENTS_FILE="$prompt_events" ui_flow_begin --domain workspace --title 'Prompt 测试' >/dev/null 2>/dev/null
selected="$(SCHEMX_UI_EVENTS_FILE="$prompt_events" ui_prompt multiselect --message '目标' --option core 'Core' --option vue 'Vue' 2>>"$prompt_interaction_stderr")"
[[ "$selected" == $'core\nvue' ]]
assert_contains "$(<"$prompt_events")" '"event":"prompt.completed"'
assert_contains "$(<"$prompt_events")" '"value":["core","vue"]'
interactive_confirm="$(SCHEMX_UI_EVENTS_FILE="$prompt_events" ui_prompt confirm --message '交互确认' 2>>"$prompt_interaction_stderr")"
[[ "$interactive_confirm" == true ]]
assert_contains "$(<"$prompt_events")" '"message":"交互确认"'
assert_contains "$(<"$prompt_events")" '"value":true'

prompt_layout="$temp_dir/prompt-layout.stderr"
(
  export SCHEMX_UI_FORMAT=plain
  ui_flow_begin --domain workspace --title 'Prompt 布局' >/dev/null 2>/dev/null
  _ui_prompt_clack() {
    printf '提示视觉输出\n' >&2
    printf 'true\n'
  }
  prompt_value="$(ui_prompt confirm --message '布局确认')"
  [[ "$prompt_value" == true ]]
  ui_note '提示之后'
) 2>"$prompt_layout"
assert_rail_gap_before "$prompt_layout" '[说明] 提示之后'

export SCHEMX_UI_ASSUME_YES=true
confirm_result="$(CI=true _UI_TEST_NONINTERACTIVE=true ui_prompt confirm --message '确认')"
[[ "$confirm_result" == 'true' ]]

set +e
SCHEMX_UI_FORMAT=plain ui_task --title '失败任务' --log live -- bash -c 'exit 7' >"$plain_stdout" 2>"$plain_stderr"
failure_code=$?
set -e
[[ "$failure_code" -eq 7 ]]
assert_contains "$(<"$plain_stderr")" '退出码 7'
assert_rail_gap_before "$plain_stderr" '退出码 7'

service_events="$temp_dir/service-events.jsonl"
SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$service_events" ui_flow_begin --domain workspace --title '服务测试' >/dev/null 2>/dev/null
set +e
SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$service_events" ui_service --title '可取消服务' -- bash -c 'exit 130' >"$plain_stdout" 2>"$plain_stderr"
service_code=$?
set -e
[[ "$service_code" -eq 130 ]]
assert_contains "$(<"$plain_stderr")" '已取消'
assert_contains "$(<"$service_events")" '"status":"cancelled"'
assert_rail_gap_before "$plain_stderr" '已取消'
SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$service_events" ui_flow_end cancelled '服务测试结束' >/dev/null 2>/dev/null

set +e
SCHEMX_UI_FORMAT=plain ui_task --title '参数错误' --log invalid -- true >"$plain_stdout" 2>"$plain_stderr"
usage_code=$?
set -e
[[ "$usage_code" -eq 2 ]]
assert_contains "$(<"$plain_stderr")" '未知任务日志策略'

printf 'ui.test.sh: 通过\n'
