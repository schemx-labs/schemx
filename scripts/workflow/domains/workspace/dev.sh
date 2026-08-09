#!/usr/bin/env bash

# dev 命令域规则：只选择定义 dev 或 dev:h5 的目标，并以持续运行方式启动开发服务。

# 返回用户选择后的开发服务目标记录。交互环境只允许选择一个目标；
# 非交互环境仍可通过 `all` 批量启动所有可用目标。
workspace_dev_select_targets() {
  local root_dir="$1"
  local requested_target="${2:-}"

  workspace_select_task_targets "$root_dir" dev "$requested_target" single
}

# 执行一个开发服务目标。
workspace_dev_run_target() {
  local package_name="$1"
  local script_name="$2"

  ui_service --title "启动 ${package_name}" -- pnpm --filter "$package_name" run "$script_name" || return
}
