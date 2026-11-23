#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少用于生成 release tag 的包名。"
fi

release_tags=()

for pkg in "$@"; do
  tag_name="$(release_tag_name "$pkg")"

  if [[ -n "$(git tag -l "$tag_name")" ]]; then
    die "Git tag $tag_name 已存在。"
  fi

  release_tags+=("$tag_name")
done

for tag_name in "${release_tags[@]}"; do
  info "创建 release tag：$tag_name"
  git tag -a "$tag_name" -m "release: $tag_name"
done

info "推送 main 与 release tag"
git push origin main

for tag_name in "${release_tags[@]}"; do
  git push origin "$tag_name"
done
