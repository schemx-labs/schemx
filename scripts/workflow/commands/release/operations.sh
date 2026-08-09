#!/usr/bin/env bash

# 发布验证、发布和标记编排。公开函数：release_verify_plan、release_restore_prerelease_versions、release_publish_packages、release_create_markers。

# 消费冻结计划运行所有发布前检查，不执行任何发布写操作。
release_verify_plan() {
  local plan_file="$1"
  local channel
  local package package_name
  local package_rows

  plan_read "$plan_file" >/dev/null || return
  channel="$(plan_channel "$plan_file")"
  package_rows="$(plan_packages "$plan_file")"
  ui_flow_group --title '发布前检查' --description '验证工作区、发布凭据与 registry；所有检查均在冻结计划之后执行。' || return
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
      ui_task --title "验证 ${tag} 可用" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-tag-available "$tag" || return
      ui_task --title "验证 ${tag} GitHub Release 可用" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-github-release-available "$tag" || return
    done < <(plan_release_records "$plan_file")
  fi
  while IFS=$'\t' read -r package_name baseline_version release_version; do
    [[ -n "$package_name" ]] || continue
    ui_task --title "验证 ${package_name}@${release_version} 可用" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-version-available "$package_name" "$release_version" || return
    if [[ "$channel" != 'latest' && "$channel" != 'dev' ]]; then
      ui_task --title "验证 ${package_name} 预发布基线" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" assert-prerelease-baseline-available "$package_name" "$baseline_version" || return
    fi
  done < <(plan_version_records "$plan_file")

  ui_flow_group --title '质量与产物' --description '逐包执行质量任务；产物检查使用 pnpm 的实际发布文件规则。' || return
  while IFS=$'\t' read -r package package_name; do
    [[ -n "$package" ]] || continue
    local quality_task
    for quality_task in lint type-check test build; do
      ui_task --title "验证 ${package_name} ${quality_task}" --log live -- pnpm --dir "packages/$package" run "$quality_task" || return
    done
    ui_task --title "检查 ${package_name} 发布产物" --log live -- pnpm --filter "$package_name" pack --dry-run || return
  done <<< "$package_rows"

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
    cp "$backup_directory/$package.json" "$workflow_root/packages/$package/package.json"
  done < <(plan_release_records "$plan_file")
  rm -rf "$backup_directory"
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
    if ui_task --title "发布 ${package_name}@${version}" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" publish "$workflow_root/packages/$package" "$dist_tag"; then
      published+=("${package_name}@${version}")
      continue
    else
      exit_code=$?
    fi
    ui_status error "发布中断：已发布 ${published[*]:-无}；失败 ${package_name}@${version}；未执行 ${records[*]:$((index + 1))}。"
    return "$exit_code"
  done
}

# 为已成功发布的包创建 Tag 与 GitHub Release。预发布 Tag 固定指向计划冻结时的源码提交。
release_create_markers() {
  local plan_file="$1"
  local tag_target="$2"
  local prerelease="$3"
  local package package_name version tag notes_file
  local release_arguments

  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    ui_task --title "创建 ${tag}" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" create-tag "$tag" "$tag_target" || return
  done < <(plan_release_records "$plan_file")
  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    ui_task --title "推送 ${tag}" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" push-tag "$tag" || return
  done < <(plan_release_records "$plan_file")
  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    notes_file="$(mktemp "${TMPDIR:-/tmp}/schemx-release-notes.XXXXXX")" || return
    ui_task --title "生成 ${tag} Release notes" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" write-release-notes "$package" "$package_name" "$version" "$tag" "$tag_target" "$notes_file" || return
    release_arguments=(release create "$tag" --title "$tag" --notes-file "$notes_file")
    [[ "$prerelease" == 'true' ]] && release_arguments+=(--prerelease)
    if ui_task --title "创建 GitHub Release：${tag}" --log live -- bash "$workflow_root/scripts/workflow/domains/release/runner.sh" create-github-release "$tag" "$notes_file" "$prerelease"; then
      :
    else
      local exit_code=$?
      rm -f "$notes_file"
      return "$exit_code"
    fi
    rm -f "$notes_file"
  done < <(plan_release_records "$plan_file")
}
