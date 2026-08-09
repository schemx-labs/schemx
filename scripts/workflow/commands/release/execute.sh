#!/usr/bin/env bash

# release execute 命令编排：只消费冻结计划，负责版本写入、发布、标记和恢复边界。

release_execute_plan() {
  local plan_file="$1"
  local channel version_action source_sha
  local package package_name version tag
  local backup_directory=''
  local package_files=()

  plan_read "$plan_file" >/dev/null || return
  channel="$(plan_channel "$plan_file")"
  version_action="$(plan_value "$plan_file" versionAction)"
  source_sha="$(plan_value "$plan_file" sourceSha)"
  release_render_plan "$plan_file" || return
  ui_prompt confirm --message '确认执行冻结的发布计划？' || { ui_status warning '已取消发布；冻结计划未被修改。'; return 130; }
  release_verify_plan "$plan_file" || return
  ui_flow_group --title '执行发布' --description '以下步骤将依次执行 npm 发布、Git Tag 与 GitHub Release；发布成功的包无法自动撤回。' || return
  if [[ "$channel" == latest && "$version_action" != current ]]; then
    while IFS=$'\t' read -r package package_name version tag; do
      [[ -n "$package" ]] || continue
      ui_task --title "写入 ${package_name}@${version}" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" write-package-version "$package" "$version" || return
      package_files+=("packages/$package/package.json")
    done < <(release_plan_release_records "$plan_file")
    ui_task --title '同步 pnpm-lock.yaml' --log live -- pnpm install --lockfile-only || return
    package_files+=(pnpm-lock.yaml)
    ui_task --title '提交正式版版本变更' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" commit-release-version 'chore(发布): 更新正式版本' "${package_files[@]}" || return
  elif [[ "$channel" != latest ]]; then
    backup_directory="$(mktemp -d "${TMPDIR:-/tmp}/schemx-release-versions.XXXXXX")" || return
    trap 'release_restore_prerelease_versions "$backup_directory" "$plan_file"' EXIT
    while IFS=$'\t' read -r package package_name version tag; do
      [[ -n "$package" ]] || continue
      cp "$workflow_root/packages/$package/package.json" "$backup_directory/$package.json"
      ui_task --title "写入临时 ${package_name}@${version}" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" write-package-version "$package" "$version" || return
    done < <(release_plan_release_records "$plan_file")
  fi
  if release_publish_packages "$plan_file" "$(plan_value "$plan_file" distTag)"; then
    :
  else
    local exit_code=$?
    release_restore_prerelease_versions "$backup_directory" "$plan_file"
    trap - EXIT
    return "$exit_code"
  fi
  if [[ -n "$backup_directory" ]]; then release_restore_prerelease_versions "$backup_directory" "$plan_file"; trap - EXIT; fi
  if [[ "$channel" != dev ]]; then
    if [[ "$channel" == latest ]]; then
      ui_task --title '推送正式版提交' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" push-commit || return
    fi
    [[ "$channel" == latest ]] && source_sha='HEAD'
    release_create_markers "$plan_file" "$source_sha" "$( [[ "$channel" != latest ]] && printf true || printf false )" || return
  fi
  release_render_outcome "$plan_file" || return
  ui_flow_end success '发布完成。'
}
