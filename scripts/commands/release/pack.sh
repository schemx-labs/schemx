#!/usr/bin/env bash

# release pack 命令编排：生成可供本地安装验证的 tarball，不执行 npm 发布。

release_pack() {
  local target="${1:-all}"
  local package
  local packages
  local destination="$workflow_root/.packs"
  local display_command

  packages="$(release_resolve_target "$target")" || return
  ui_flow_begin --domain release --title '本地发布产物' --description '生成 tarball 供本地安装验证；不会执行 npm 发布。' || return
  ui_flow_group --title '打包发布产物' --description "输出目录：${destination#$workflow_root/}" || return
  while IFS= read -r package; do
    [[ -n "$package" ]] || continue
    display_command="$(_ui_command_text pnpm --filter "$(targets_package_name "$package")" pack --pack-destination .packs)" || return
    ui_task --title "生成 $(targets_package_name "$package") tarball" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" pack-artifact "$(targets_package_name "$package")" "$destination" || { local exit_code=$?; ui_flow_end failed "本地 tarball 生成失败：$(targets_package_name "$package")。"; return "$exit_code"; }
  done <<< "$packages"
  ui_flow_end success "本地 tarball 已生成至 ${destination#$workflow_root/}。"
}
