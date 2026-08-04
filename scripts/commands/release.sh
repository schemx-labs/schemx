#!/usr/bin/env bash

# 新发布流程入口。当前提供安全的 plan / dry-run 纵切，不调用旧发布脚本。

set -euo pipefail

workflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$workflow_root"

source "$workflow_root/scripts/modules/release/targets.sh"
source "$workflow_root/scripts/modules/release/versions.sh"
source "$workflow_root/scripts/modules/release/plan.sh"
source "$workflow_root/scripts/modules/release/preflight.sh"
source "$workflow_root/scripts/modules/release/quality.sh"
source "$workflow_root/scripts/modules/release/artifacts.sh"
source "$workflow_root/scripts/modules/release/publish.sh"
source "$workflow_root/scripts/modules/release/git.sh"
source "$workflow_root/scripts/modules/release/github.sh"
source "$workflow_root/scripts/modules/release/notes.sh"
source "$workflow_root/scripts/modules/release/tests.sh"
source "$workflow_root/scripts/lib/ui.sh"
source "$workflow_root/scripts/modules/release/feedback.sh"
source "$workflow_root/scripts/modules/release/inputs.sh"
source "$workflow_root/scripts/commands/release/check.sh"
source "$workflow_root/scripts/commands/release/pack.sh"
source "$workflow_root/scripts/commands/release/publish.sh"
source "$workflow_root/scripts/commands/release/execute.sh"
source "$workflow_root/scripts/commands/release/test.sh"

# 输出新流程的安全入口帮助。
release_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh release plan <channel> <target> <version-action> [--output <file>]
  bash scripts/workflow.sh release dry-run <channel> <target> <version-action>
  bash scripts/workflow.sh release publish [channel] [target] [version-action]
  bash scripts/workflow.sh release check [target]
  bash scripts/workflow.sh release pack [target]
  bash scripts/workflow.sh release test
  bash scripts/workflow.sh release verify <plan-file>
  bash scripts/workflow.sh release execute <plan-file>

channel：dev、alpha、beta、rc、next、latest
target：all、core、vue、vant，或以英文逗号分隔的多个包
version-action：patch、minor、major、current（仅 latest）或精确 x.y.z
USAGE
}

# 解析 check / pack 命令的可选发布目标，并始终返回固定的包顺序。
release_resolve_target() {
  local target="${1:-all}"

  targets_resolve "$target" || {
    ui_status error "无效发布目标：${target}"
    return 2
  }
}

# 消费冻结计划运行所有发布前检查，不执行任何发布写操作。
release_verify_plan() {
  local plan_file="$1"
  local channel
  local package package_name
  local package_rows
  local preflight_module
  local display_command

  plan_read "$plan_file" >/dev/null || return
  channel="$(plan_channel "$plan_file")"
  package_rows="$(plan_packages "$plan_file")"
  printf -v preflight_module '%q' "$workflow_root/scripts/modules/release/preflight.sh"

  ui_flow_group --title '发布前检查' --description '验证工作区、发布凭据与 registry；所有检查均在冻结计划之后执行。' || return
  display_command="$(_ui_command_text git status --porcelain)" || return
  ui_task --title '验证工作区状态' --display "$display_command" --log live -- bash -c "source ${preflight_module}; preflight_assert_clean_worktree" || return
  if [[ "$channel" == 'latest' ]]; then
    display_command="$(_ui_command_text git branch --show-current)" || return
    ui_task --title '验证正式发布分支' --display "$display_command" --log live -- bash -c "source ${preflight_module}; preflight_assert_main_branch" || return
  fi
  display_command="$(_ui_command_text pnpm config get registry)" || return
  ui_task --title '验证 npm registry' --display "$display_command" --log live -- bash -c "source ${preflight_module}; preflight_assert_registry" || return
  display_command="$(_ui_command_text pnpm whoami --registry "${NPM_REGISTRY:-https://registry.npmjs.org/}")" || return
  ui_task --title '验证 npm 发布凭据' --display "$display_command" --log live -- bash -c "source ${preflight_module}; preflight_assert_npm_auth" || return
  if [[ "$channel" != 'dev' ]]; then
    display_command="$(_ui_command_text gh auth status)" || return
    ui_task --title '验证 GitHub 凭据' --display "$display_command" --log live -- bash -c "source ${preflight_module}; preflight_assert_github_auth" || return
    while IFS=$'\t' read -r package package_name version tag; do
      [[ -n "$package" ]] || continue
      display_command="$(_ui_command_text git rev-parse --verify --quiet "refs/tags/$tag"); $(_ui_command_text git ls-remote --exit-code --tags origin "refs/tags/$tag")" || return
      ui_task --title "验证 ${tag} 可用" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" assert-tag-available "$tag" || return
      display_command="$(_ui_command_text gh release view "$tag")" || return
      ui_task --title "验证 ${tag} GitHub Release 可用" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" assert-github-release-available "$tag" || return
    done < <(release_plan_release_records "$plan_file")
  fi
  while IFS=$'\t' read -r package_name baseline_version release_version; do
    [[ -n "$package_name" ]] || continue
    display_command="$(_ui_command_text pnpm view "${package_name}@${release_version}" version --registry "${NPM_REGISTRY:-https://registry.npmjs.org/}")" || return
    ui_task --title "验证 ${package_name}@${release_version} 可用" --display "$display_command" --log live -- bash -c "source ${preflight_module}; preflight_assert_version_available \"\$1\" \"\$2\"" _ "$package_name" "$release_version" || return
    if [[ "$channel" != 'latest' && "$channel" != 'dev' ]]; then
      display_command="$(_ui_command_text pnpm view "${package_name}@${baseline_version}" version --registry "${NPM_REGISTRY:-https://registry.npmjs.org/}")" || return
      ui_task --title "验证 ${package_name} 预发布基线" --display "$display_command" --log live -- bash -c "source ${preflight_module}; preflight_assert_prerelease_baseline_available \"\$1\" \"\$2\"" _ "$package_name" "$baseline_version" || return
    fi
  done < <(release_plan_version_records "$plan_file")

  ui_flow_group --title '质量与产物' --description 'Turborepo 负责可缓存质量任务；产物检查使用 pnpm 的实际发布文件规则。' || return
  while IFS=$'\t' read -r package package_name; do
    [[ -n "$package" ]] || continue
    ui_task --title "验证 ${package_name} 质量" --log live -- pnpm exec turbo run lint type-check test build --filter="...${package_name}" || return
    ui_task --title "检查 ${package_name} 发布产物" --log live -- pnpm --filter "$package_name" pack --dry-run || return
  done <<< "$package_rows"

  ui_status success '发布前检查完成：尚未执行 npm 发布、版本写入、Git Tag 或 GitHub Release。'
}

# 从冻结计划读取包名、版本与 Tag，输出供发布适配器消费的稳定记录。
release_plan_release_records() {
  local plan_file="$1"

  plan_release_records "$plan_file"
}

# 输出 npm 包名、正式版本基线与实际版本，供发布前可用性校验消费。
release_plan_version_records() {
  local plan_file="$1"

  plan_version_records "$plan_file"
}

# 将指定包的 package.json 临时写为冻结计划中的版本，供预发布 npm 打包与发布使用。
release_write_package_version() {
  local package="$1"
  local version="$2"

  npm --prefix "$workflow_root/packages/$package" version "$version" --no-git-tag-version
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
  done < <(release_plan_release_records "$plan_file")
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
  local display_command
  local exit_code

  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] && records+=("$package"$'\t'"$package_name"$'\t'"$version"$'\t'"$tag")
  done < <(release_plan_release_records "$plan_file")

  for index in "${!records[@]}"; do
    IFS=$'\t' read -r package package_name version tag <<< "${records[$index]}"
    display_command="$(_ui_command_text pnpm --dir "packages/$package" publish --access public --registry "${NPM_REGISTRY:-https://registry.npmjs.org/}" --tag "$dist_tag" --no-git-checks)" || return
    if ui_task --title "发布 ${package_name}@${version}" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" publish "$workflow_root/packages/$package" "$dist_tag"; then
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
  local display_command
  local release_arguments

  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    display_command="$(_ui_command_text git tag -a "$tag" "$tag_target" -m "release: ${tag}")" || return
    ui_task --title "创建 ${tag}" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" create-tag "$tag" "$tag_target" || return
  done < <(release_plan_release_records "$plan_file")
  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    display_command="$(_ui_command_text git push origin "$tag")" || return
    ui_task --title "推送 ${tag}" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" push-tag "$tag" || return
  done < <(release_plan_release_records "$plan_file")
  while IFS=$'\t' read -r package package_name version tag; do
    [[ -n "$package" ]] || continue
    notes_file="$(mktemp "${TMPDIR:-/tmp}/schemx-release-notes.XXXXXX")" || return
    display_command="$(_ui_command_text git tag --sort=-creatordate --merged "$tag_target"); $(_ui_command_text git log --no-merges --format=%s "$tag_target")" || return
    ui_task --title "生成 ${tag} Release notes" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" write-release-notes "$package" "$package_name" "$version" "$tag" "$tag_target" "$notes_file" || return
    release_arguments=(release create "$tag" --title "$tag" --notes-file "$notes_file")
    [[ "$prerelease" == 'true' ]] && release_arguments+=(--prerelease)
    display_command="$(_ui_command_text gh "${release_arguments[@]}")" || return
    if ui_task --title "创建 GitHub Release：${tag}" --display "$display_command" --log live -- bash "$workflow_root/scripts/modules/release/runner.sh" create-github-release "$tag" "$notes_file" "$prerelease"; then
      :
    else
      local exit_code=$?
      rm -f "$notes_file"
      return "$exit_code"
    fi
    rm -f "$notes_file"
  done < <(release_plan_release_records "$plan_file")
}

# 创建冻结计划；预发布序号在写入计划前从 npm registry 查询并固定下来。
release_create_plan() {
  # 发布通道。
  local channel="$1"
  # 原始发布目标。
  local target="$2"
  # 版本动作或精确版本。
  local version_action="$3"
  # 输出计划文件。
  local plan_file="$4"
  # 已解析的目标包。
  local packages=()
  # 换行分隔的目标解析结果。
  local resolved_targets
  # 当前遍历到的目标包。
  local package
  # 当前 package.json 版本。
  local current_version
  # 计算得到的正式版本基线。
  local baseline_version
  # 实际发布版本。
  local release_version
  # 当前包对应的 npm 预发布序号。
  local sequence
  # 当前源码短 SHA。
  local source_sha
  # 传入计划序列化器的包记录。
  local records=()

  versions_is_channel "$channel" || {
    ui_status error "未知发布通道：${channel}"
    return 2
  }
  versions_is_action "$version_action" || {
    ui_status error "无效版本动作：${version_action}"
    return 2
  }
  if [[ "$channel" != 'latest' && "$version_action" == 'current' ]]; then
    ui_status error '预发布通道必须选择 patch、minor、major 或精确 x.y.z 版本基线。'
    return 2
  fi

  if ! resolved_targets="$(targets_resolve "$target")"; then
    ui_status error "无效发布目标：${target}"
    return 2
  fi
  while IFS= read -r package; do
    [[ -n "$package" ]] && packages+=("$package")
  done <<< "$resolved_targets"
  if versions_is_stable "$version_action" && [[ "${#packages[@]}" -ne 1 ]]; then
    ui_status error '精确版本仅允许单包目标。'
    return 2
  fi

  source_sha="${SCHEMX_RELEASE_SHA:-$(git rev-parse --short HEAD 2>/dev/null || printf 'local')}"
  for package in "${packages[@]}"; do
    current_version="$(targets_package_version "$workflow_root" "$package")"
    baseline_version="$(versions_baseline "$current_version" "$version_action")" || {
      ui_status error "无法根据 ${current_version} 计算 ${version_action} 版本基线。"
      return 2
    }
    if [[ "$channel" == 'alpha' || "$channel" == 'beta' || "$channel" == 'rc' || "$channel" == 'next' ]]; then
      if [[ -n "${SCHEMX_RELEASE_PRERELEASE_SEQUENCE:-}" ]]; then
        sequence="$SCHEMX_RELEASE_PRERELEASE_SEQUENCE"
        [[ "$sequence" =~ ^[0-9]+$ ]] || {
          ui_status error 'SCHEMX_RELEASE_PRERELEASE_SEQUENCE 必须是非负整数。'
          return 2
        }
      else
        sequence="$(preflight_next_prerelease_sequence "$(targets_package_name "$package")" "$baseline_version" "$channel")" || {
          ui_status error "无法从 npm registry 查询 $(targets_package_name "$package") 的 ${channel} 预发布序号。"
          return 1
        }
      fi
    else
      sequence=0
    fi
    release_version="$(versions_release_version "$channel" "$baseline_version" "$sequence")" || return 2
    records+=("${package}|${current_version}|${baseline_version}|${release_version}")
  done

  plan_write "$plan_file" "$channel" "$target" "$version_action" "$(versions_dist_tag "$channel")" "$source_sha" "${records[@]}"
}

# 解析 CLI 并执行发布计划或按冻结计划推进工作流。
release_main() {
  # 子命令。
  local command="${1:-help}"
  # 计划输出路径。
  local plan_file=''
  shift || true

  case "$command" in
    plan | dry-run)
      [[ $# -ge 3 ]] || { release_usage; return 2; }
      local channel="$1"
      local target="$2"
      local version_action="$3"
      shift 3
      if [[ "${1:-}" == '--output' ]]; then
        plan_file="${2:-}"
        [[ -n "$plan_file" ]] || return 2
      fi
      ui_flow_begin --domain release --title '生成发布计划' --description '生成并冻结版本计划；不会执行发布写操作。' || return
      if [[ -z "$plan_file" ]]; then
        plan_file="$(mktemp "${TMPDIR:-/tmp}/schemx-release-plan.XXXXXX")" || {
          ui_flow_end failed '无法创建发布计划文件。'
          return 1
        }
      fi
      release_create_plan "$channel" "$target" "$version_action" "$plan_file" || {
        local exit_code=$?
        [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '发布计划创建已取消。' || ui_flow_end failed '发布计划创建失败。'
        return "$exit_code"
      }
      release_render_plan "$plan_file" || {
        local exit_code=$?
        ui_flow_end failed '发布计划展示失败。'
        return "$exit_code"
      }
      if [[ "$command" == 'dry-run' ]]; then
        ui_status success 'dry-run 已完成：未执行质量检查、npm 发布、Git Tag 或 GitHub Release。'
      fi
      ui_flow_end success "${command} 完成。"
      printf '%s\n' "$plan_file"
      ;;
    publish)
      release_publish "$@"
      ;;
    check)
      [[ $# -le 1 ]] || { release_usage; return 2; }
      release_check "${1:-all}"
      ;;
    pack)
      [[ $# -le 1 ]] || { release_usage; return 2; }
      release_pack "${1:-all}"
      ;;
    test)
      [[ $# -eq 0 ]] || { release_usage; return 2; }
      release_test
      ;;
    verify)
      [[ $# -eq 1 ]] || { release_usage; return 2; }
      ui_flow_begin --domain release --title '验证发布计划' --description '读取冻结计划并执行发布前检查。' || return
      release_verify_plan "$1" || {
        local exit_code=$?
        [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '发布计划验证已取消。' || ui_flow_end failed '发布计划验证失败。'
        return "$exit_code"
      }
      ui_flow_end success '发布计划验证完成。'
      ;;
    execute)
      [[ $# -eq 1 ]] || { release_usage; return 2; }
      ui_flow_begin --domain release --title '执行发布' --description '消费冻结计划并执行发布步骤。' || return
      release_execute_plan "$1" || {
        local exit_code=$?
        [[ "$exit_code" -eq 130 ]] && ui_flow_end cancelled '发布流程已取消。' || ui_flow_end failed '发布流程失败。'
        return "$exit_code"
      }
      ;;
    help | -h | --help)
      release_usage
      ;;
    *)
      release_usage
      return 2
      ;;
  esac
}

release_main "$@"
