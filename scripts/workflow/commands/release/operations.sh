#!/usr/bin/env bash

# 发布验证、发布和标记编排。公开函数：release_verify_plan、release_restore_prerelease_versions、release_publish_packages、release_create_markers。

# 对一个发布包执行质量脚本和发布产物检查。
# 参数：依次为包标识、包名和是否继续执行同包剩余任务。
# 返回：全部成功时返回 0；取消返回 130；否则返回首个任务失败码。
release_verify_package_quality() {
  local package="$1"
  local package_name="$2"
  local keep_going="$3"
  local quality_task
  local first_failure=0
  local exit_code

  for quality_task in lint type-check test build; do
    if ! targets_has_script "$package" "$quality_task"; then
      ui_task_skip --title "$quality_task" --reason 'package.json 未定义对应 script。' || return
      continue
    fi
    if ui_task --title "$quality_task" --log live -- pnpm --dir "$(targets_package_dir "$package")" run "$quality_task"; then
      continue
    fi
    exit_code=$?
    [[ "$exit_code" -eq 130 ]] && return 130
    [[ "$first_failure" -ne 0 ]] || first_failure=$exit_code
    [[ "$keep_going" == true ]] || return "$exit_code"
  done
  if ! ui_task --title '检查发布产物' --log live -- pnpm --filter "$package_name" pack --dry-run; then
    exit_code=$?
    [[ "$exit_code" -eq 130 ]] && return 130
    [[ "$first_failure" -ne 0 ]] || first_failure=$exit_code
  fi
  return "$first_failure"
}

# 消费冻结计划运行所有发布前检查，不执行任何发布写操作。
# 参数：$1 为计划文件，$2 为可选的 true/false keep-going 策略。
# 返回：全部成功时返回 0；取消返回 130；否则返回首个验证失败码。
release_verify_plan() {
  local plan_file="$1"
  local keep_going="${2:-false}"
  local channel
  local package package_name
  local package_rows
  local package_records=()
  local failed_packages=()
  local first_failure=0
  local exit_code
  local index

  [[ "$keep_going" == true || "$keep_going" == false ]] || return 2
  plan_read "$plan_file" >/dev/null || return
  channel="$(plan_channel "$plan_file")" || return
  package_rows="$(plan_packages "$plan_file")" || return
  ui_group_begin --title '发布前检查' --description '验证工作区、发布凭据与 registry；所有检查均在冻结计划之后执行。' || return
  ui_task --title '验证工作区状态' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-clean-worktree || return
  if [[ "$channel" == 'latest' ]]; then
    ui_task --title '验证正式发布分支' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-main-branch || return
  fi
  ui_task --title '验证 npm registry' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-registry || return
  ui_task --title '验证 npm 发布凭据' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-npm-auth || return
  if [[ "$channel" != 'dev' ]]; then
    ui_task --title '验证 GitHub 凭据' --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-github-auth || return
    while IFS=$'\t' read -r package package_name version tag; do
      [[ -n "$package" ]] || continue
      ui_task --title "验证 ${tag} 可用" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-tag-available "$tag" || return
      ui_task --title "验证 ${tag} GitHub Release 可用" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-github-release-available "$tag" || return
    done < <(plan_release_records "$plan_file")
  fi
  while IFS=$'\t' read -r package_name baseline_version release_version; do
    [[ -n "$package_name" ]] || continue
    ui_task --title "验证 ${package_name}@${release_version} 可用" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-version-available "$package_name" "$release_version" || return
    if [[ "$channel" != 'latest' && "$channel" != 'dev' ]]; then
      ui_task --title "验证 ${package_name} 预发布基线" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-prerelease-baseline-available "$package_name" "$baseline_version" || return
    fi
  done < <(plan_version_records "$plan_file")
  ui_group_end success '发布前检查完成。' || return

  while IFS= read -r package; do
    [[ -n "$package" ]] && package_records+=("$package")
  done <<< "$package_rows"
  ui_group_begin --title '质量与产物' --description '逐包执行质量任务；产物检查使用 pnpm 的实际发布文件规则。' || return
  for index in "${!package_records[@]}"; do
    IFS=$'\t' read -r package package_name <<< "${package_records[$index]}"
    ui_group_begin --title "[$((index + 1))/${#package_records[@]}] ${package_name}" --item-key "$package_name" || return
    if release_verify_package_quality "$package" "$package_name" "$keep_going"; then
      ui_group_end success "${package_name} 检查完成。" || return
      continue
    fi
    exit_code=$?
    if [[ "$exit_code" -eq 130 ]]; then
      ui_group_end cancelled "${package_name} 检查已取消。" || true
      ui_group_end cancelled '质量与产物检查已取消。' || true
      return 130
    fi
    ui_group_end failed "${package_name} 检查失败。" || true
    failed_packages+=("${package_name}（exit ${exit_code}）")
    [[ "$first_failure" -ne 0 ]] || first_failure=$exit_code
    if [[ "$keep_going" != true ]]; then
      ui_group_end failed '质量与产物检查失败。' || true
      return "$exit_code"
    fi
  done

  if [[ "$first_failure" -ne 0 ]]; then
    local failed_content
    failed_content="$(printf '%s\n' "${failed_packages[@]}")"
    ui_summary --title '质量检查失败项' --tone error --content "$failed_content" || return
    ui_group_end failed "质量与产物检查失败：${#failed_packages[@]} 个包未通过。" || return
    return "$first_failure"
  fi
  ui_group_end success "质量与产物检查完成：${#package_records[@]} 个包全部通过。" || return

  ui_status success '发布前检查完成：尚未执行 npm 发布、版本写入、Git Tag 或 GitHub Release。'
}

# 恢复预发布窗口内临时改写的 package.json；可重复调用。
release_restore_prerelease_versions() {
  local backup_directory="$1"
  local plan_file="$2"
  local package package_name version tag

  [[ -n "$backup_directory" && -d "$backup_directory" ]] || return 0
  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" && -f "$backup_directory/$package.json" ]] || continue
    cp "$backup_directory/$package.json" "$workflow_root/$(targets_package_dir "$package")/package.json" || return
  done < <(plan_release_records "$plan_file")
  rm -rf "$backup_directory" || return
}

# 按计划记录串行发布 npm 包；失败时报告已发布、失败和未执行的包，避免掩盖不可回滚状态。
release_publish_packages() {
  local plan_file="$1"
  local dist_tag="$2"
  local package package_name version tag
  local records=()
  local published=()
  local index
  local exit_code

  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] && records+=("$package"$'\t'"$package_name"$'\t'"$version"$'\t'"$tag")
  done < <(plan_release_records "$plan_file")

  for index in "${!records[@]}"; do
    IFS=$'\t' read -r package package_name version tag <<< "${records[$index]}"
    if ui_task --title "发布 ${package_name}@${version}" --item-key "$package_name" --interactive --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" publish "$workflow_root/$(targets_package_dir "$package")" "$dist_tag"; then
      published+=("${package_name}@${version}")
      continue
    else
      exit_code=$?
    fi
    ui_status error "发布中断：已发布 ${published[*]:-无}；失败 ${package_name}@${version}；未执行 ${records[*]:$((index + 1))}。"
    return "$exit_code"
  done
}

# 为已成功发布的稳定版创建 Tag 与 GitHub Release。
release_create_markers() {
  local plan_file="$1"
  local tag_target="$2"
  local prerelease="$3"
  local package package_name version tag notes_file
  local release_arguments

  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    ui_task --title "创建 ${tag}" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" create-tag "$tag" "$tag_target" || return
  done < <(plan_release_records "$plan_file")
  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    ui_task --title "推送 ${tag}" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" push-tag "$tag" || return
  done < <(plan_release_records "$plan_file")
  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    notes_file="$(mktemp "${TMPDIR:-/tmp}/schemx-release-notes.XXXXXX")" || return
    ui_task --title "生成 ${tag} Release notes" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" write-release-notes "$package" "$package_name" "$version" "$tag" "$tag_target" "$notes_file" || return
    release_arguments=(release create "$tag" --title "$tag" --notes-file "$notes_file")
    [[ "$prerelease" == 'true' ]] && release_arguments+=(--prerelease)
    if ui_task --title "创建 GitHub Release：${tag}" --item-key "$package_name" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" create-github-release "$tag" "$notes_file" "$prerelease"; then
      :
    else
      local exit_code=$?
      rm -f "$notes_file" || return
      return "$exit_code"
    fi
    rm -f "$notes_file" || return
  done < <(plan_release_records "$plan_file")
}
