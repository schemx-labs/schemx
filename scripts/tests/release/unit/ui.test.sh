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
    $0 ~ /^[[:space:]]*│$/ { blanks += 1; next }
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
    $0 ~ /^[[:space:]]*│$/ { blanks += 1; next }
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
[[ "$copyable_command_gaps" -eq 1 ]] || {
  printf '断言失败：可复制命令前应有一条导轨间隔行。\n' >&2
  sed -n l "$copyable_summary_stderr" >&2
  exit 1
}

events_file="$temp_dir/events.jsonl"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$events_file"
  ui_flow_begin --domain workspace --title '构建' --description '说明'
  ui_group_begin --title '质量检查' --description '分组说明'
  ui_note '执行说明'
  ui_status info 'info'
  ui_status success 'ok'
  ui_task --title '成功任务' --log live -- bash -c 'printf 原始输出'
  ui_group_end success '质量检查完成'
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
assert_rail_gap_count_before "$plain_stderr" '[成功] 成功任务' 1
rg -q '成功任务（[0-9]+\.[0-9]{2}s）' "$plain_stderr" || {
  printf '断言失败：任务耗时应保留两位小数。\n' >&2
  sed -n l "$plain_stderr" >&2
  exit 1
}
assert_contains "$plain_output" '[成功] 质量检查完成'
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

# TTY 直通任务不能进入 Spinner，也必须保留标准任务事件和结果。
interactive_stdout="$temp_dir/interactive.stdout"
interactive_stderr="$temp_dir/interactive.stderr"
interactive_events="$temp_dir/interactive-events.jsonl"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$interactive_events"
  ui__can_spinner() { return 0; }
  gum() {
    printf '断言失败：TTY 直通任务不应调用 gum。\n' >&2
    return 1
  }
  ui_flow_begin --domain workspace --title 'TTY 直通测试' >/dev/null
  ui_task --title 'TTY 直通任务' --interactive --log live -- bash -c 'printf 原始输入'
  ui_flow_end success 'TTY 直通测试完成' >/dev/null
) >"$interactive_stdout" 2>"$interactive_stderr"
assert_contains "$(<"$interactive_stdout")" '原始输入'
assert_contains "$(<"$interactive_stderr")" '[成功] TTY 直通任务'
jq -se 'any(.[]; .event == "task.started") and any(.[]; .event == "task.finished" and .payload.status == "success")' "$interactive_events" >/dev/null

set +e
SCHEMX_UI_FORMAT=plain ui_task --title '无效 TTY 任务' --interactive --log capture -- true >"$plain_stdout" 2>"$plain_stderr"
interactive_usage_code=$?
set -e
[[ "$interactive_usage_code" -eq 2 ]]
assert_contains "$(<"$plain_stderr")" '--interactive 仅支持 --log live'

spinner_stdout="$temp_dir/spinner.stdout"
spinner_stderr="$temp_dir/spinner.stderr"
(
  export SCHEMX_UI_FORMAT=plain
  ui__can_spinner() { return 0; }
  gum() {
    printf '断言失败：live 任务不应调用 gum。\n' >&2
    return 1
  }
  ui_task --title 'live 直通任务' --log live -- bash -c 'printf stdout; printf stderr >&2'
) >"$spinner_stdout" 2>"$spinner_stderr"
assert_contains "$(<"$spinner_stdout")" 'stdout'
assert_contains "$(<"$spinner_stderr")" 'stderr'

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
  ui_task --title 'capture 失败任务' --log capture -- bash -c 'printf "真实错误\\n" >&2; exit 7'
) >"$spinner_failure_stdout" 2>"$spinner_failure_stderr"
spinner_failure_code=$?
set -e
[[ "$spinner_failure_code" -eq 7 ]]
assert_contains "$(<"$spinner_failure_stderr")" '真实错误'
assert_contains "$(<"$spinner_failure_stderr")" '退出码 7'
assert_rail_gap_count_before "$spinner_failure_stderr" '退出码 7' 1

event_names=''
while IFS= read -r event_name; do
  event_names+="${event_names:+ }${event_name}"
done < <(jq -r '.event' "$events_file")
[[ "$event_names" == 'flow.started group.started note status status task.started task.finished group.finished summary flow.finished' ]]
jq -se 'all(.[]; .schema == "schemx.ui/v2" and (.runId | type) == "string" and (.flowId | type) == "string" and (.payload | type) == "object")' "$events_file" >/dev/null
jq -se 'all(.[] | select(.event == "flow.started" or .event == "summary" or .event == "flow.finished"); .groupId == null)' "$events_file" >/dev/null
jq -se 'all(.[] | select(.event == "group.started" or .event == "note" or .event == "status" or .event == "task.started" or .event == "task.finished" or .event == "group.finished"); (.groupId | type) == "string")' "$events_file" >/dev/null
jq -se 'any(.[]; .event == "task.finished" and .payload.status == "success" and .payload.exitCode == 0)' "$events_file" >/dev/null
jq -se 'any(.[]; .event == "task.finished" and (.payload.durationSeconds | type) == "number")' "$events_file" >/dev/null
jq -se 'any(.[]; .event == "task.started" and (.payload.taskId | type) == "string" and .payload.command == "bash -c '\''printf 原始输出'\''" and .payload.argv == ["bash", "-c", "printf 原始输出"])' "$events_file" >/dev/null
jq -se '([.[] | select(.event == "task.started") | .payload.taskId] == [.[] | select(.event == "task.finished") | .payload.taskId])' "$events_file" >/dev/null

# Scoped group 必须维持父子关系、task 归属、itemKey 继承和后代计数。
nested_events="$temp_dir/nested-events.jsonl"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$nested_events"
  ui_flow_begin --domain workspace --title '嵌套分组' >/dev/null
  ui_group_begin --title '质量检查' --item-key quality >/dev/null
  outer_group_id="$SCHEMX_UI_GROUP_ID"
  ui_group_begin --title '@schemx/core' --item-key '@schemx/core' >/dev/null
  inner_group_id="$SCHEMX_UI_GROUP_ID"
  ui_task --title lint --log live -- true >/dev/null
  ui_task_skip --title test --reason '缺少 script' >/dev/null
  ui_group_end success '@schemx/core 完成' >/dev/null
  [[ "$SCHEMX_UI_GROUP_ID" == "$outer_group_id" ]]
  [[ "$inner_group_id" != "$outer_group_id" ]]
  ui_group_end success '质量检查完成' >/dev/null
  [[ -z "${SCHEMX_UI_GROUP_ID:-}" ]]
  ui_flow_end success '嵌套分组完成' >/dev/null
) 2>/dev/null
jq -se '
  ([.[] | select(.event == "group.started")][0].payload) as $outer
  | ([.[] | select(.event == "group.started")][1].payload) as $inner
  | $outer.depth == 1
    and $outer.parentGroupId == null
    and $inner.depth == 2
    and $inner.parentGroupId == $outer.groupId
    and any(.[]; .event == "task.started" and .groupId == $inner.groupId and .payload.itemKey == "@schemx/core")
    and any(.[]; .event == "task.skipped" and .groupId == $inner.groupId and .payload.status == "skipped")
    and any(.[]; .event == "group.finished" and .payload.groupId == $inner.groupId and .payload.tasks == {total:2,success:1,failed:0,cancelled:0,skipped:1})
    and any(.[]; .event == "group.finished" and .payload.groupId == $outer.groupId and .payload.tasks.total == 2 and .payload.groups.total == 1)
' "$nested_events" >/dev/null

# Group API 必须拒绝非法配对，并允许调用方修复未闭合的成功 flow。
set +e
SCHEMX_UI_FORMAT=plain ui_group_end success >/dev/null 2>"$plain_stderr"
orphan_group_end_code=$?
set -e
[[ "$orphan_group_end_code" -eq 2 ]]
(
  export SCHEMX_UI_FORMAT=plain
  ui_flow_begin --domain workspace --title '严格收口' >/dev/null
  ui_group_begin --title '未结束分组' >/dev/null
  set +e
  ui_flow_end success '不应成功' >/dev/null
  strict_flow_code=$?
  set -e
  [[ "$strict_flow_code" -eq 2 ]]
  ui_group_end success '分组已结束' >/dev/null
  ui_flow_end success '严格收口完成' >/dev/null
) 2>/dev/null

# 失败 flow 自动按 LIFO 收口，ui_group_run 保留原始命令退出码。
implicit_events="$temp_dir/implicit-events.jsonl"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$implicit_events"
  ui_flow_begin --domain workspace --title '隐式收口' >/dev/null
  ui_group_begin --title '外层' >/dev/null
  ui_group_begin --title '内层' >/dev/null
  ui_flow_end failed '流程失败' >/dev/null
) 2>/dev/null
jq -se '
  [.[] | select(.event == "group.finished") | .payload] as $groups
  | ($groups | length) == 2
    and $groups[0].title == "内层"
    and $groups[1].title == "外层"
    and all($groups[]; .status == "failed" and .implicit == true)
' "$implicit_events" >/dev/null
(
  export SCHEMX_UI_FORMAT=plain
  ui_flow_begin --domain workspace --title 'Group run' >/dev/null
  set +e
  ui_group_run --title '失败包装器' -- bash -c 'exit 7' >/dev/null
  group_run_code=$?
  set -e
  [[ "$group_run_code" -eq 7 ]]
  [[ "$(ui__group_stack_size)" -eq 0 ]]
  ui_flow_end failed '包装器失败已处理' >/dev/null
) 2>/dev/null

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
SCHEMX_UI_EVENTS_FILE="$prompt_events" ui_prompt confirm --message '交互确认' >"$plain_stdout" 2>>"$prompt_interaction_stderr"
[[ ! -s "$plain_stdout" ]]
assert_contains "$(<"$prompt_events")" '"message":"交互确认"'
assert_contains "$(<"$prompt_events")" '"value":true'
set +e
ui__prompt_clack() { printf 'false\n'; }
SCHEMX_UI_EVENTS_FILE="$prompt_events" ui_prompt confirm --message '拒绝确认' >"$plain_stdout" 2>>"$prompt_interaction_stderr"
confirm_false_code=$?
set -e
[[ "$confirm_false_code" -eq 1 ]]
[[ ! -s "$plain_stdout" ]]
assert_contains "$(<"$prompt_events")" '"message":"拒绝确认"'
assert_contains "$(<"$prompt_events")" '"value":false'
SCHEMX_UI_EVENTS_FILE="$prompt_events" ui_flow_end success 'Prompt 测试结束' >/dev/null 2>/dev/null

prompt_layout="$temp_dir/prompt-layout.stderr"
(
  export SCHEMX_UI_FORMAT=plain
  ui_flow_begin --domain workspace --title 'Prompt 布局' >/dev/null 2>/dev/null
  ui__prompt_clack() {
    printf '提示视觉输出\n' >&2
    printf 'true\n'
  }
  ui_prompt confirm --message '布局确认'
  ui_note '提示之后'
  ui_flow_end success 'Prompt 布局结束'
) 2>"$prompt_layout"
assert_rail_gap_before "$prompt_layout" '[说明] 提示之后'

export SCHEMX_UI_ASSUME_YES=true
CI=true _UI_TEST_NONINTERACTIVE=true ui_prompt confirm --message '确认' >"$plain_stdout" 2>>"$prompt_interaction_stderr"
[[ ! -s "$plain_stdout" ]]
unset SCHEMX_UI_ASSUME_YES
set +e
CI=true _UI_TEST_NONINTERACTIVE=true ui_prompt confirm --message '确认' >"$plain_stdout" 2>>"$prompt_interaction_stderr"
noninteractive_confirm_code=$?
set -e
[[ "$noninteractive_confirm_code" -eq 2 ]]

set +e
SCHEMX_UI_FORMAT=plain ui_task --title '失败任务' --log live -- bash -c 'exit 7' >"$plain_stdout" 2>"$plain_stderr"
failure_code=$?
set -e
[[ "$failure_code" -eq 7 ]]
assert_contains "$(<"$plain_stderr")" '退出码 7'
assert_rail_gap_count_before "$plain_stderr" '退出码 7' 1

task_cancel_events="$temp_dir/task-cancel-events.jsonl"
set +e
SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$task_cancel_events" ui_task --title '取消任务' -- bash -c 'exit 130' >"$plain_stdout" 2>"$plain_stderr"
task_cancel_code=$?
set -e
[[ "$task_cancel_code" -eq 130 ]]
assert_contains "$(<"$plain_stderr")" '已取消'
jq -se 'any(.[]; .event == "task.finished" and .payload.status == "cancelled" and .payload.exitCode == 130)' "$task_cancel_events" >/dev/null

service_events="$temp_dir/service-events.jsonl"
SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$service_events" ui_flow_begin --domain workspace --title '服务测试' >/dev/null 2>/dev/null
set +e
SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$service_events" ui_service --title '可取消服务' -- bash -c 'printf "服务日志"; exit 130' >"$plain_stdout" 2>"$plain_stderr"
service_code=$?
set -e
[[ "$service_code" -eq 130 ]]
assert_contains "$(<"$plain_stdout")" '服务日志'
assert_contains "$(<"$plain_stderr")" '已取消'
assert_contains "$(<"$service_events")" '"status":"cancelled"'
assert_rail_gap_count_before "$plain_stderr" '已取消' 1
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

ui__prompt_clack() { printf '%s\n' "$3"; }
structured_prompt_output="$(ui_prompt select --message '保留分隔符' --option 'value:::tail' 'label:::tail' 2>/dev/null)"
jq -e '.value == "value:::tail" and .label == "label:::tail"' <<< "$structured_prompt_output" >/dev/null

set +e
SCHEMX_UI_FORMAT=plain ui_prompt group-multiselect --message '孤立选项' --group packages 'Packages' --option plugins vite 'Vite' >/dev/null 2>"$plain_stderr"
orphan_group_code=$?
SCHEMX_UI_FORMAT=plain ui_prompt group-multiselect --message '空分组' --group packages 'Packages' --option plugins vite 'Vite' --group plugins 'Plugins' >/dev/null 2>"$plain_stderr"
empty_group_code=$?
set -e
[[ "$orphan_group_code" -eq 2 ]]
[[ "$empty_group_code" -eq 2 ]]

sensitive_events="$temp_dir/sensitive-events.jsonl"
sensitive_stderr="$temp_dir/sensitive.stderr"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$sensitive_events"
  ui_flow_begin --domain tools --title '敏感任务'
  ui_task --title '隐藏命令' --sensitive --log live -- bash -c 'true' >/dev/null
  ui_flow_end success '完成'
) 2>"$sensitive_stderr"
assert_not_contains "$(<"$sensitive_stderr")" "bash -c 'true'"
jq -se 'any(.[]; .event == "task.started" and .payload.sensitive == true and .payload.command == null and .payload.argv == null)' "$sensitive_events" >/dev/null

event_isolation_file="$temp_dir/event-isolation.jsonl"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$event_isolation_file" SCHEMX_UI_CORRELATION_ID='build-42'
  ui_flow_begin --domain workspace --title '第一个流程' >/dev/null
  first_flow_id="$SCHEMX_UI_FLOW_ID"
  ui_flow_end success '完成' >/dev/null
  unset SCHEMX_UI_EVENTS_FILE
  ui_flow_begin --domain workspace --title '第二个流程' >/dev/null
  second_flow_id="$SCHEMX_UI_FLOW_ID"
  ui_flow_end success '完成' >/dev/null
  [[ "$first_flow_id" != "$second_flow_id" ]]
) 2>/dev/null
[[ "$(wc -l < "$event_isolation_file" | tr -d ' ')" -eq 2 ]]
jq -se 'all(.[]; .schema == "schemx.ui/v2" and .correlationId == "build-42")' "$event_isolation_file" >/dev/null

child_events="$temp_dir/child-events.jsonl"
(
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$child_events"
  ui_flow_begin --domain workspace --title '父流程' >/dev/null
  parent_flow_id="$SCHEMX_UI_FLOW_ID"
  bash -c 'source "$1/scripts/workflow/ui/api.sh"; ui_status info 子进程事件 >/dev/null' _ "$root_dir"
  ui_flow_end success '完成' >/dev/null
  jq -se --arg flow_id "$parent_flow_id" 'any(.[]; .event == "status" and .flowId == $flow_id and .payload.message == "子进程事件")' "$child_events" >/dev/null
) 2>/dev/null

flow_guard_stderr="$temp_dir/flow-guard.stderr"
(
  export SCHEMX_UI_FORMAT=plain
  ui_flow_begin --domain workspace --title '外层流程' >/dev/null
  layout_file="$SCHEMX_UI_LAYOUT_STATE_FILE"
  set +e
  ui_flow_begin --domain tools --title '嵌套流程' >/dev/null
  nested_flow_code=$?
  set -e
  [[ "$nested_flow_code" -eq 2 ]]
  [[ -f "$layout_file" ]]
  ui_flow_end success '外层完成' >/dev/null
  [[ ! -e "$layout_file" ]]
) 2>"$flow_guard_stderr"
assert_contains "$(<"$flow_guard_stderr")" '不能开始嵌套流程'

trap_marker="$temp_dir/exit-trap.marker"
trap_events="$temp_dir/exit-trap-events.jsonl"
set +e
(
  trap 'printf preserved > "$trap_marker"' EXIT
  export SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$trap_events"
  ui_flow_begin --domain workspace --title '异常清理' >/dev/null 2>/dev/null
  ui_group_begin --title '未闭合分组' >/dev/null 2>/dev/null
  exit 7
) 2>/dev/null
trap_exit_code=$?
set -e
[[ "$trap_exit_code" -eq 7 ]]
[[ "$(<"$trap_marker")" == preserved ]]
jq -se 'any(.[]; .event == "group.finished" and .payload.implicit == true and .payload.status == "failed") and any(.[]; .event == "flow.finished" and .payload.implicit == true and .payload.exitCode == 7)' "$trap_events" >/dev/null

# INT/TERM 必须补齐取消事件，并保留约定的信号退出码。
for signal_record in 'INT 130' 'TERM 143'; do
  read -r signal expected_code <<< "$signal_record"
  signal_events="$temp_dir/${signal}.events.jsonl"
  set +e
  SCHEMX_UI_FORMAT=plain SCHEMX_UI_EVENTS_FILE="$signal_events" bash -c '
    source "$1/scripts/workflow/ui/api.sh"
    ui_flow_begin --domain workspace --title "信号清理" >/dev/null 2>/dev/null
    ui_group_begin --title "未闭合分组" >/dev/null 2>/dev/null
    kill -s "$2" "$$"
  ' _ "$root_dir" "$signal" >/dev/null 2>/dev/null
  signal_exit_code=$?
  set -e
  [[ "$signal_exit_code" -eq "$expected_code" ]]
  jq -se --argjson exit_code "$expected_code" '
    any(.[]; .event == "group.finished" and .payload.implicit == true and .payload.status == "cancelled")
    and any(.[]; .event == "flow.finished" and .payload.implicit == true and .payload.status == "cancelled" and .payload.exitCode == $exit_code)
  ' "$signal_events" >/dev/null
done

# release verify 的 keep-going 只作用于逐包质量检查，并返回首个失败码。
(
  source "$root_dir/scripts/workflow/commands/release/operations.sh"
  workflow_root="$root_dir"
  plan_read() { return 0; }
  plan_channel() { printf dev; }
  plan_packages() { printf '%s\n' $'core\t@schemx/core' $'vue\t@schemx/vue'; }
  plan_release_records() { return 0; }
  plan_version_records() { return 0; }
  ui_group_begin() { return 0; }
  ui_group_end() { return 0; }
  ui_task() { return 0; }
  ui_summary() { return 0; }
  ui_status() { return 0; }
  verified_packages=()
  release_verify_package_quality() {
    verified_packages+=("$2")
    [[ "$2" != '@schemx/core' ]] || return 7
  }
  set +e
  release_verify_plan ignored false
  verify_fail_fast_code=$?
  set -e
  [[ "$verify_fail_fast_code" -eq 7 ]]
  [[ "${verified_packages[*]}" == '@schemx/core' ]]
  verified_packages=()
  set +e
  release_verify_plan ignored true
  verify_collect_code=$?
  set -e
  [[ "$verify_collect_code" -eq 7 ]]
  [[ "${verified_packages[*]}" == '@schemx/core @schemx/vue' ]]
)

# release pack 的 keep-going 同样执行剩余包并保留首个失败码。
(
  source "$root_dir/scripts/workflow/commands/release/pack.sh"
  workflow_root="$root_dir"
  release_resolve_target() { printf '%s\n' core vue; }
  targets_package_name() { printf '@schemx/%s' "$1"; }
  ui_flow_begin() { return 0; }
  ui_flow_end() { return 0; }
  ui_group_begin() { return 0; }
  ui_group_end() { return 0; }
  ui_summary() { return 0; }
  packed_packages=()
  ui_task() {
    local item_key=''
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --item-key) item_key="$2"; shift 2 ;;
        --) break ;;
        *) shift ;;
      esac
    done
    packed_packages+=("$item_key")
    [[ "$item_key" != '@schemx/core' ]] || return 8
  }
  set +e
  release_pack all true
  pack_collect_code=$?
  set -e
  [[ "$pack_collect_code" -eq 8 ]]
  [[ "${packed_packages[*]}" == '@schemx/core @schemx/vue' ]]
)

# release CLI 接受任意位置的 keep-going，但发布和执行命令必须拒绝该选项。
(
  source "$root_dir/scripts/workflow/commands/release/main.sh"
  release_parse_keep_going beta --keep-going core patch
  [[ "$RELEASE_KEEP_GOING" == true ]]
  [[ "${RELEASE_POSITIONAL[*]}" == 'beta core patch' ]]
  release_publish_called=false
  release_publish() { release_publish_called=true; }
  set +e
  release_main publish --keep-going >/dev/null
  publish_keep_going_code=$?
  release_main execute --keep-going >/dev/null
  execute_keep_going_code=$?
  set -e
  [[ "$publish_keep_going_code" -eq 2 ]]
  [[ "$execute_keep_going_code" -eq 2 ]]
  [[ "$release_publish_called" == false ]]
)

source "$root_dir/scripts/workflow/commands/release/execute.sh"
release_verify_called=false
plan_read() { return 0; }
plan_channel() { printf 'dev'; }
plan_value() { printf 'current'; }
release_render_plan() { return 0; }
release_verify_plan() { release_verify_called=true; return 0; }
ui_prompt() { return 1; }
ui_status() { return 0; }
set +e
release_execute_plan "$temp_dir/plan.json"
release_refusal_code=$?
set -e
[[ "$release_refusal_code" -eq 130 ]]
[[ "$release_verify_called" == false ]]

# 预发布版本写入后的普通失败也必须在函数返回前恢复，不能只依赖 EXIT trap。
(
  source "$root_dir/scripts/workflow/commands/release/execute.sh"
  workflow_root="$temp_dir"
  plan_read() { return 0; }
  plan_channel() { printf dev; }
  plan_value() {
    case "$2" in
      versionAction) printf current ;;
      sourceSha) printf source-sha ;;
      distTag) printf dev ;;
    esac
  }
  release_render_plan() { return 0; }
  ui_prompt() { return 0; }
  release_verify_plan() { return 0; }
  ui_group_begin() { return 0; }
  plan_release_records() { printf '%s\n' $'core\t@schemx/core\t1.0.0-dev.1\tcore-v1.0.0-dev.1'; }
  targets_package_dir() { printf packages/core; }
  cp() { return 0; }
  ui_task() { return 7; }
  restored=false
  release_restore_prerelease_versions() {
    restored=true
    [[ -n "$1" && "$2" == "$temp_dir/plan.json" ]]
  }
  set +e
  release_execute_plan "$temp_dir/plan.json"
  execute_failure_code=$?
  set -e
  [[ "$execute_failure_code" -eq 7 ]]
  [[ "$restored" == true ]]
  [[ -z "$_RELEASE_EXECUTE_BACKUP_DIRECTORY" && -z "$_RELEASE_EXECUTE_PLAN_FILE" ]]
)

printf 'ui.test.sh: 通过\n'
