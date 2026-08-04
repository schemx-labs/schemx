#!/usr/bin/env bash

# Git 发布适配器。Tag 名称由冻结计划提供，方法不推导包或版本。

git_module_root="$(cd "$(dirname "$BASH_SOURCE")/../.." && pwd)"
if ! declare -F ui_status >/dev/null 2>&1; then
  source "$git_module_root/lib/ui.sh"
fi

# 将版本文件加入暂存区并创建发布提交。
git_commit_release_version() {
  local message="$1"
  shift

  git add -- "$@"
  git commit -m "$message"
}

# 创建指向指定提交的带注释发布 Tag。
git_create_release_tag() {
  local tag_name="$1"
  local target="$2"

  git tag -a "$tag_name" "$target" -m "release: ${tag_name}"
}

# 确认本地与 origin 均不存在同名 Tag；远端查询异常不得误判为可用。
git_assert_release_tag_available() {
  local tag_name="$1"
  local output
  local status

  if git rev-parse --verify --quiet "refs/tags/$tag_name" >/dev/null; then
    ui_status error "Git Tag 已存在：$tag_name"
    return 1
  fi
  if output="$(git ls-remote --exit-code --tags origin "refs/tags/$tag_name" 2>&1)"; then
    ui_status error "远端 Git Tag 已存在：$tag_name"
    return 1
  else
    status=$?
  fi
  [[ "$status" -eq 2 ]] && return 0
  ui_status error "无法确认远端 Git Tag $tag_name 是否可用：$output"
  return 1
}

# 推送当前分支上的发布提交。
git_push_release_commit() {
  git push origin HEAD
}

# 推送一个已创建的发布 Tag。
git_push_release_tag() {
  local tag_name="$1"

  git push origin "$tag_name"
}
