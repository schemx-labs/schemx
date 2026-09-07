#!/usr/bin/env bash

# GitHub Release 适配器。发布说明来源由调用方决定，不读取或修改发布计划。

github_module_root="$(cd "$(dirname "$BASH_SOURCE")/../.." && pwd)"
if ! declare -F ui_status >/dev/null 2>&1; then
  source "$github_module_root/ui/api.sh"
fi

# 从显式环境变量或 origin remote 解析 owner/repository。
github_repository() {
  local repository="${GITHUB_REPOSITORY:-}"

  if [[ -z "$repository" ]]; then
    repository="$(git config --get remote.origin.url 2>/dev/null || true)"
  fi
  case "$repository" in
    git@github.com:*) repository="${repository#git@github.com:}" ;;
    ssh://git@github.com/*) repository="${repository#ssh://git@github.com/}" ;;
    https://github.com/*) repository="${repository#https://github.com/}" ;;
    http://github.com/*) repository="${repository#http://github.com/}" ;;
  esac
  repository="${repository%.git}"
  [[ "$repository" =~ ^[^/]+/[^/]+$ ]] || {
    ui_status error '无法从 origin remote 解析 GitHub 仓库，请设置 GITHUB_REPOSITORY=owner/repo。'
    return 1
  }
  printf '%s' "$repository"
}

# 创建一条包级 GitHub Release；预发布通道显式标记为 prerelease。
github_create_release() {
  local tag_name="$1"
  local notes_file="$2"
  local prerelease="$3"
  local repository
  local arguments=()

  repository="$(github_repository)" || return
  arguments=(release create "$tag_name" --repo "$repository" --title "$tag_name" --notes-file "$notes_file")
  if [[ "$prerelease" == 'true' ]]; then
    arguments+=(--prerelease)
  fi
  gh "${arguments[@]}"
}

# 确认目标 GitHub Release 不存在；查询异常不能被误判为可创建。
github_assert_release_available() {
  local tag_name="$1"
  local repository
  local output

  repository="$(github_repository)" || return

  if output="$(gh release view "$tag_name" --repo "$repository" 2>&1)"; then
    ui_status error "GitHub Release 已存在：$tag_name"
    return 1
  fi
  if [[ "$output" == *'release not found'* || "$output" == *'HTTP 404'* ]]; then
    return 0
  fi
  ui_status error "无法确认 GitHub Release $tag_name 是否可用：$output"
  return 1
}
