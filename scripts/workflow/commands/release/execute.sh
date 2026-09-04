#!/usr/bin/env bash

# release execute 命令编排：只消费冻结计划，负责版本写入、发布、标记和恢复边界。

# 当前 execute 调用尚未恢复的预发布版本备份。
_RELEASE_EXECUTE_BACKUP_DIRECTORY=''
_RELEASE_EXECUTE_PLAN_FILE=''

# 恢复当前 execute 调用写入的临时版本；没有活动备份时保持幂等。
release_execute_restore_active_versions() {
  local backup_directory="$_RELEASE_EXECUTE_BACKUP_DIRECTORY"
  local plan_file="$_RELEASE_EXECUTE_PLAN_FILE"
  [[ -n "$backup_directory" ]] || return 0
  release_restore_prerelease_versions "$backup_directory" "$plan_file" || return
  _RELEASE_EXECUTE_BACKUP_DIRECTORY=''
  _RELEASE_EXECUTE_PLAN_FILE=''
}

# 在 release execute 异常退出时恢复临时版本、结束 UI flow 并保留原始退出码。
# 参数：$1 为原始退出码。
# 副作用：该函数最终退出当前 Shell。
release_execute_exit_handler() {
  local exit_code="$1"

  release_execute_restore_active_versions || true
  ui_flow_end failed '发布流程异常退出。' || true
  exit "$exit_code"
}

# 在 release execute 收到信号时恢复临时版本、取消 UI flow 并重新发送原信号。
# 参数：依次为信号名和约定退出码。
# 副作用：恢复 flow 开始前的 trap 后向当前 Shell 重新发送信号；宿主忽略信号时按约定码退出。
release_execute_signal_handler() {
  local signal="$1"
  local exit_code="$2"

  release_execute_restore_active_versions || true
  ui_flow_end cancelled "发布流程收到 ${signal} 信号。" || true
  kill -s "$signal" "$$"
  exit "$exit_code"
}

# 执行已经确认和验证的冻结计划；预发布版本由外层统一恢复。
release_execute_plan_steps() {
  local plan_file="$1"
  local channel="$2"
  local version_action="$3"
  local source_sha="$4"
  local package package_name version tag
  local package_files=()

  ui_group_begin --title '执行发布' --description '以下步骤将依次执行 npm 发布、Git Tag 与 GitHub Release；发布成功的包无法自动撤回。' || return
  if [[ "$channel" == latest && "$version_action" != current ]]; then
    while IFS=$'\t' read -r package package_name version tag; do
      [[ -n "$package" ]] || continue
      ui_task --title "写入 ${package_name}@${version}" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" write-package-version "$package" "$version" || return
      package_files+=("$(targets_package_dir "$package")/package.json")
    done < <(plan_release_records "$plan_file")
    ui_task --title '同步 pnpm-lock.yaml' --log live -- pnpm install --lockfile-only || return
    package_files+=(pnpm-lock.yaml)
    ui_task --title '提交正式版版本变更' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" commit-release-version 'chore(发布): 更新正式版本' "${package_files[@]}" || return
  elif [[ "$channel" != latest ]]; then
    _RELEASE_EXECUTE_BACKUP_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/schemx-release-versions.XXXXXX")" || return
    _RELEASE_EXECUTE_PLAN_FILE="$plan_file"
    trap 'release_execute_exit_handler "$?"' EXIT
    trap 'release_execute_signal_handler INT 130' INT
    trap 'release_execute_signal_handler TERM 143' TERM
    while IFS=$'\t' read -r package package_name version tag; do
      [[ -n "$package" ]] || continue
      cp "$workflow_root/$(targets_package_dir "$package")/package.json" "$_RELEASE_EXECUTE_BACKUP_DIRECTORY/$package.json" || return
      ui_task --title "写入临时 ${package_name}@${version}" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" write-package-version "$package" "$version" || return
    done < <(plan_release_records "$plan_file")
  fi
  release_publish_packages "$plan_file" "$(plan_value "$plan_file" distTag)" || return
  if [[ "$channel" == latest ]]; then
    ui_task --title '推送正式版提交' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" push-commit || return
    source_sha='HEAD'
    release_create_markers "$plan_file" "$source_sha" false || return
  elif [[ "$channel" == next ]]; then
    release_create_markers "$plan_file" "$source_sha" true || return
  fi
  release_render_outcome "$plan_file" || return
  ui_group_end success '发布步骤执行完成。' || return
}

release_execute_plan() {
  local plan_file="$1"
  local channel version_action source_sha
  local execute_code=0
  local restore_code=0

  plan_read "$plan_file" >/dev/null || return
  channel="$(plan_channel "$plan_file")" || return
  version_action="$(plan_value "$plan_file" versionAction)" || return
  source_sha="$(plan_value "$plan_file" sourceSha)" || return
  release_render_plan "$plan_file" || return
  if ui_prompt confirm --message '确认执行冻结的发布计划？'; then
    :
  else
    local confirm_code=$?
    if [[ "$confirm_code" -eq 1 || "$confirm_code" -eq 130 ]]; then
      ui_status warning '已取消发布；冻结计划未被修改。'
      return 130
    fi
    return "$confirm_code"
  fi
  release_verify_plan "$plan_file" false || return
  release_execute_plan_steps "$plan_file" "$channel" "$version_action" "$source_sha" || execute_code=$?
  release_execute_restore_active_versions || restore_code=$?
  [[ "$execute_code" -eq 0 ]] || return "$execute_code"
  [[ "$restore_code" -eq 0 ]] || return "$restore_code"
  ui_flow_end success '发布完成。'
}
