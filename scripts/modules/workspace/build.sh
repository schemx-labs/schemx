#!/usr/bin/env bash

# build 命令域规则：普通 build 交给 Turborepo，build:h5 保持直接执行。

# 返回用户选择后的构建目标记录。
workspace_build_select_targets() {
  local root_dir="$1"
  local requested_target="${2:-}"

  workspace_select_task_targets "$root_dir" build "$requested_target"
}

# 执行一个构建目标，并保留 Turborepo 对普通 build 任务的依赖编排与缓存。
workspace_build_run_target() {
  local package_name="$1"
  local script_name="$2"

  case "$script_name" in
    build)
      ui_task --title "构建 ${package_name}" --log live -- pnpm exec turbo run build "--filter=${package_name}" || return
      ;;
    build:h5)
      ui_task --title "构建 ${package_name}" --log live -- pnpm --filter "$package_name" run build:h5 || return
      ;;
    *)
      ui_status error "不支持的构建 script：${script_name}"
      return 2
      ;;
  esac
}
