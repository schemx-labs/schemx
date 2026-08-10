#!/usr/bin/env bash

# build 命令域规则：按选中的 workspace 目录直接执行 build script。

# 返回用户选择后的构建目标记录。
workspace_build_select_targets() {
  local root_dir="$1"
  local requested_target="${2:-}"

  workspace_select_task_targets "$root_dir" build "$requested_target"
}

# 执行一个构建目标。
workspace_build_run_target() {
  local scope="$1"
  local directory="$2"
  local package_name="$3"
  local script_name="$4"
  local progress="${5:-}"
  local title="构建 ${package_name}"

  [[ -z "$progress" ]] || title="[${progress}] ${title}"

  case "$script_name" in
    build)
      ui_task --title "$title" --item-key "$package_name" --log live -- pnpm --dir "$scope/$directory" run build || return
      ;;
    build:h5)
      ui_task --title "$title" --item-key "$package_name" --log live -- pnpm --dir "$scope/$directory" run build:h5 || return
      ;;
    *)
      ui_status error "不支持的构建 script：${script_name}"
      return 2
      ;;
  esac
}
