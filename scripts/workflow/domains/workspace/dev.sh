#!/usr/bin/env bash

# dev 命令域规则：只选择定义 dev 或 dev:h5 的目标，并以持续运行方式启动开发服务。

# 返回用户选择后的唯一开发服务目标记录。
# 非交互环境必须显式提供单个目标；`all` 和多目标均返回 2。
workspace_dev_select_targets() {
  local root_dir="$1"
  local requested_target="${2:-}"
  local effective_target="${requested_target:-${SCHEMX_WORKFLOW_TARGETS:-${SCHEMX_WORKFLOW_TARGET:-}}}"
  local records
  local target_count

  if [[ -z "$effective_target" ]] && ! ui_is_interactive; then
    ui_status error '非交互环境启动 dev 时必须显式提供一个目标。'
    return 2
  fi
  records="$(workspace_select_task_targets "$root_dir" dev "$requested_target" single)" || return
  target_count="$(awk 'NF { count += 1 } END { print count + 0 }' <<< "$records")"
  if [[ "$target_count" -gt 1 ]]; then
    ui_status error 'dev 仅支持一个目标，不支持 all 或多目标。'
    return 2
  fi
  printf '%s' "$records"
}

# 执行一个开发服务目标。
workspace_dev_run_target() {
  local package_name="$1"
  local script_name="$2"

  ui_service --title "启动 ${package_name}" -- pnpm --filter "$package_name" run "$script_name" || return
}
