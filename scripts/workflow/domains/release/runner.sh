#!/usr/bin/env bash

# 将库函数适配为可执行命令，供 Gum Spinner 在子进程中安全调用。

set -euo pipefail

runner_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
source "$runner_root/scripts/workflow/ui/api.sh"
source "$runner_root/scripts/workflow/domains/release/targets.sh"
source "$runner_root/scripts/workflow/domains/release/publish.sh"
source "$runner_root/scripts/workflow/domains/release/preflight.sh"
source "$runner_root/scripts/workflow/domains/release/git.sh"
source "$runner_root/scripts/workflow/domains/release/github.sh"
source "$runner_root/scripts/workflow/domains/release/notes.sh"
source "$runner_root/scripts/workflow/domains/release/quality.sh"
source "$runner_root/scripts/workflow/domains/release/artifacts.sh"

runner_write_package_version() {
  local package="$1"
  local version="$2"

  npm --prefix "$runner_root/$(targets_package_dir "$package")" version "$version" --no-git-tag-version
}

case "${1:-}" in
  publish)
    shift
    publish_package "$@"
    ;;
  write-package-version)
    shift
    runner_write_package_version "$@"
    ;;
  commit-release-version)
    shift
    git_commit_release_version "$@"
    ;;
  create-tag)
    shift
    git_create_release_tag "$@"
    ;;
  assert-tag-available)
    shift
    git_assert_release_tag_available "$@"
    ;;
  assert-clean-worktree)
    preflight_assert_clean_worktree
    ;;
  assert-main-branch)
    preflight_assert_main_branch
    ;;
  assert-registry)
    preflight_assert_registry
    ;;
  assert-npm-auth)
    preflight_assert_npm_auth
    ;;
  assert-github-auth)
    preflight_assert_github_auth
    ;;
  assert-version-available)
    shift
    preflight_assert_version_available "$@"
    ;;
  assert-prerelease-baseline-available)
    shift
    preflight_assert_prerelease_baseline_available "$@"
    ;;
  push-tag)
    shift
    git_push_release_tag "$@"
    ;;
  push-commit)
    shift
    git_push_release_commit "$@"
    ;;
  create-github-release)
    shift
    github_create_release "$@"
    ;;
  assert-github-release-available)
    shift
    github_assert_release_available "$@"
    ;;
  write-release-notes)
    shift
    notes_write_release_notes "$runner_root" "$@"
    ;;
  assert-installation)
    quality_assert_installation
    ;;
  assert-package-configuration)
    quality_assert_package_configuration
    ;;
  assert-artifacts)
    shift
    artifacts_assert_package "$@"
    ;;
  pack-artifact)
    shift
    artifacts_pack_package "$@"
    ;;
  *)
    ui_status error "未知 workflow release runner 操作：${1:-}"
    exit 2
    ;;
esac
