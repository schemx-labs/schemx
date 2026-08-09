#!/usr/bin/env bash

set -euo pipefail

test_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$test_dir/../../../.." && pwd)"
source "$root_dir/scripts/workflow/ui/api.sh"

# 单测需自行控制输出格式，不能继承 release:test 顶层流程导出的格式缓存。
unset SCHEMX_UI_RESOLVED_FORMAT

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

assert_rail_gap_count_before() {
  local file="$1"
  local marker="$2"
  local expected="$3"
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
  [[ "$gap" -eq "$expected" ]] || {
    printf '断言失败：%q 前的导轨间隔行数应为 %s，实际为 %s\n' "$marker" "$expected" "$gap" >&2
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

copyable_summary_stderr="$temp_dir/copyable-summary.stderr"
copyable_command='pnpm i /tmp/core.tgz /tmp/vue.tgz'
SCHEMX_UI_FORMAT=plain ui_copyable_summary --title '安装命令' --tone success --content '已生成 2 个 tarball。' --copy "$copyable_command" >/dev/null 2>"$copyable_summary_stderr"
assert_contains "$(<"$copyable_summary_stderr")" '--- 安装命令 ---'
rg -qxF "$copyable_command" "$copyable_summary_stderr"
copyable_command_gaps="$(awk -v command="$copyable_command" '
  $0 == command { print gaps; exit }
  $0 == "│" { gaps += 1; next }
  { gaps = 0 }
' "$copyable_summary_stderr")"
[[ "$copyable_command_gaps" -eq 2 ]] || {
  printf '断言失败：可复制命令前应有两条导轨间隔行。\n' >&2
  sed -n l "$copyable_summary_stderr" >&2
  exit 1
}

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
rg -q '成功任务（[0-9]+\.[0-9]{2}s）' "$plain_stderr" || {
  printf '断言失败：任务耗时应保留两位小数。\n' >&2
  sed -n l "$plain_stderr" >&2
  exit 1
}
assert_rail_gap_before "$plain_stderr" '--- 结果摘要 ---'
assert_rail_gap_before "$plain_stderr" '[成功] 流程完成'
if rg -n '^$' "$plain_stderr" >/dev/null; then
  printf '断言失败：UI 组合输出不应出现无导轨的空行。\n' >&2
  sed -n l "$plain_stderr" >&2
  exit 1
fi

task_boundary_stderr="$temp_dir/task-boundary.stderr"
(
  export SCHEMX_UI_FORMAT=plain
  ui_flow_begin --domain workspace --title '目录任务间隔'
  ui_task --title '处理 packages/core' --log live -- true
  ui_task --title '处理 packages/validator' --log live -- true
  ui_flow_end success '目录任务间隔完成'
) >/dev/null 2>"$task_boundary_stderr"
assert_rail_gap_count_before "$task_boundary_stderr" '[任务] 处理 packages/validator' 2

spinner_stdout="$temp_dir/spinner.stdout"
spinner_stderr="$temp_dir/spinner.stderr"
(
  export SCHEMX_UI_FORMAT=plain
  ui__can_spinner() { return 0; }
  gum() {
    [[ "$1" == spin ]] || return 2
    printf '[测试] 使用 loading spinner：%s\n' "$*" >&2
    shift
    while [[ $# -gt 0 && "$1" != '--' ]]; do shift; done
    [[ "${1:-}" == '--' ]] || return 2
    shift
    "$@"
  }
  ui_task --title '带 loading 的任务' --log live -- bash -c 'printf 原始输出'
) >"$spinner_stdout" 2>"$spinner_stderr"
assert_contains "$(<"$spinner_stderr")" '使用 loading spinner'
assert_contains "$(<"$spinner_stdout")" '原始输出'

spinner_failure_stdout="$temp_dir/spinner-failure.stdout"
spinner_failure_stderr="$temp_dir/spinner-failure.stderr"
set +e
(
  export SCHEMX_UI_FORMAT=plain
  ui__can_spinner() { return 0; }
  gum() {
    [[ "$1" == spin ]] || return 2
    shift
    while [[ $# -gt 0 && "$1" != '--' ]]; do shift; done
    [[ "${1:-}" == '--' ]] || return 2
    shift
    "$@"
  }
  ui_task --title '带 loading 的失败任务' --log live -- bash -c 'printf "真实错误\\n" >&2; exit 7'
) >"$spinner_failure_stdout" 2>"$spinner_failure_stderr"
spinner_failure_code=$?
set -e
[[ "$spinner_failure_code" -eq 7 ]]
assert_contains "$(<"$spinner_failure_stderr")" '真实错误'
assert_contains "$(<"$spinner_failure_stderr")" '退出码 7'

event_names=''
while IFS= read -r event_name; do
  event_names+="${event_names:+ }${event_name}"
done < <(jq -r '.event' "$events_file")
[[ "$event_names" == 'flow.started group.started note status status task.started task.finished summary flow.finished' ]]
jq -se 'all(.[]; .schema == "schemx.ui/v1")' "$events_file" >/dev/null
jq -se 'any(.[]; .event == "task.finished" and .status == "success" and .exitCode == 0)' "$events_file" >/dev/null
jq -se 'any(.[]; .event == "task.finished" and (.durationSeconds | type) == "number")' "$events_file" >/dev/null
jq -se 'any(.[]; .event == "task.started" and .command == "bash -c '\''printf 原始输出'\''" and .argv == ["bash", "-c", "printf 原始输出"])' "$events_file" >/dev/null

ui__is_interactive() { [[ "${_UI_TEST_NONINTERACTIVE:-}" != true ]]; }
ui__prompt_clack() {
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
  ui__prompt_clack() {
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

set +e
SCHEMX_UI_FORMAT=plain ui_task --title '禁止伪造命令' --display 'pnpm build' -- true >"$plain_stdout" 2>"$plain_stderr"
display_code=$?
set -e
[[ "$display_code" -eq 2 ]]
assert_contains "$(<"$plain_stderr")" 'ui_task 用法错误'

printf 'ui.test.sh: 通过\n'
