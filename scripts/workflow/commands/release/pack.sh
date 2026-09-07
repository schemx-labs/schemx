#!/usr/bin/env bash

# release pack 命令编排：生成可供本地安装验证的 tarball，不执行 npm 发布。

release_pack() {
  local target="${1:-all}"
  local keep_going="${2:-false}"
  local package
  local packages
  local package_name
  local destination="$workflow_root/.packs"
  local records=()
  local failures=()
  local first_failure=0
  local exit_code
  local index
  local remaining_count
  local summary_content
  local failure_content

  [[ $# -le 2 && ( "$keep_going" == true || "$keep_going" == false ) ]] || return 2
  packages="$(release_resolve_target "$target")" || return
  while IFS= read -r package; do
    [[ -n "$package" ]] && records+=("$package")
  done <<< "$packages"
  ui_flow_begin --domain release --title '本地发布产物' --description '生成 tarball 供本地安装验证；不会执行 npm 发布。' || return
  ui_group_begin --title '打包发布产物' --description "输出目录：${destination#$workflow_root/}" || return
  for index in "${!records[@]}"; do
    package="${records[$index]}"
    package_name="$(targets_package_name "$package")" || return
    if ui_task --title "[$((index + 1))/${#records[@]}] 生成 ${package_name} tarball" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" pack-artifact "$package_name" "$destination"; then
      continue
    fi
    exit_code=$?
    if [[ "$exit_code" -eq 130 ]]; then
      ui_group_end cancelled "本地 tarball 生成已取消：${package_name}。" || true
      ui_flow_end cancelled '本地 tarball 生成已取消。'
      return 130
    fi
    failures+=("${package_name}（exit ${exit_code}）")
    [[ "$first_failure" -ne 0 ]] || first_failure=$exit_code
    if [[ "$keep_going" != true ]]; then
      remaining_count=$((${#records[@]} - index - 1))
      summary_content="失败：${package_name}（exit ${exit_code}）"
      summary_content+=$'\n'"未执行：${remaining_count} 个包"
      ui_summary --title '本地打包失败' --tone error --content "$summary_content" || return
      ui_group_end failed "本地 tarball 生成失败：${package_name}。" || true
      ui_flow_end failed "本地 tarball 生成失败：${package_name}。"
      return "$exit_code"
    fi
  done
  if [[ "$first_failure" -ne 0 ]]; then
    failure_content="$(printf '%s\n' "${failures[@]}")"
    ui_summary --title '本地打包失败项' --tone error --content "$failure_content" || return
    ui_group_end failed "本地 tarball 生成失败：${#failures[@]} 个包未通过。" || true
    ui_flow_end failed '本地 tarball 生成未全部完成。'
    return "$first_failure"
  fi
  ui_group_end success "本地 tarball 已生成：${#records[@]} 个包。" || return
  ui_flow_end success "本地 tarball 已生成至 ${destination#$workflow_root/}。"
}
