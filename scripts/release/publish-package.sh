#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

pkg="${1:-}"
tag="${2:-}"

if [[ -z "$pkg" ]]; then
  die "缺少要发布的包名。"
fi

info "发布 @schemx/$pkg"
printf '发布 registry：%s\n' "$NPM_REGISTRY"
if [[ -n "$tag" ]]; then
  printf '发布 tag：%s\n' "$tag"
fi
warn "$(cat <<'MESSAGE'
如果 npm 要求网页登录、二维码确认或 OTP，终端可能会停在认证提示处。
请按终端提示完成浏览器认证，完成后回到这里等待发布继续。
MESSAGE
)"

if [[ -n "$tag" ]]; then
  pnpm --dir "$(package_path "$pkg")" publish --access public --registry "$NPM_REGISTRY" --tag "$tag" --no-git-checks
  exit 0
fi

pnpm --dir "$(package_path "$pkg")" publish --access public --registry "$NPM_REGISTRY"
