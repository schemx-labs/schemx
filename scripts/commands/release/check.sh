#!/usr/bin/env bash

# release check 命令编排：验证依赖、发布配置、质量任务和实际发布产物，不产生发布写操作。

release_check() {
  local target="${1:-all}"
  local package
  local packages
  local display_command

  packages="$(release_resolve_target "$target")" || return
  ui_flow_begin --domain release --title '发布检查' --description '执行依赖一致性、发布配置、目标质量任务与实际发布文件检查。' || return
  ui_flow_group --title '发布前检查' --description '验证工作区、凭据与 registry。' || return
  display_command="$(_ui_command_text pnpm install --frozen-lockfile)" || return
  ui_task --title '安装依赖一致性检查' --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" assert-installation || { local exit_code=$?; ui_flow_end failed '发布检查失败：依赖一致性。'; return "$exit_code"; }
  display_command="$(_ui_command_text bash scripts/modules/packages/check-config.sh)" || return
  ui_task --title '运行包配置检查' --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" assert-package-configuration || { local exit_code=$?; ui_flow_end failed '发布检查失败：包配置。'; return "$exit_code"; }
  while IFS= read -r package; do
    [[ -n "$package" ]] || continue
    display_command="$(_ui_command_text pnpm exec turbo run lint type-check test build "--filter=...$(targets_package_name "$package")")" || return
    ui_task --title "验证 $(targets_package_name "$package") 质量" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" run-quality "$(targets_package_name "$package")" || { local exit_code=$?; ui_flow_end failed "发布检查失败：$(targets_package_name "$package") 质量。"; return "$exit_code"; }
    display_command="$(_ui_command_text pnpm --filter "$(targets_package_name "$package")" pack --dry-run)" || return
    ui_task --title "检查 $(targets_package_name "$package") 发布产物" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" assert-artifacts "$(targets_package_name "$package")" || { local exit_code=$?; ui_flow_end failed "发布检查失败：$(targets_package_name "$package") 产物。"; return "$exit_code"; }
  done <<< "$packages"
  ui_flow_end success '发布检查完成：未执行 npm 发布、版本写入、Git Tag 或 GitHub Release。'
}
