#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

info "检查 GitHub CLI 登录状态"
if ! command -v gh >/dev/null 2>&1; then
  die "未找到 GitHub CLI。请先安装 gh，并执行 \`gh auth login\`。"
fi

if ! gh auth status >/dev/null 2>&1; then
  die "GitHub CLI 未登录或无权限，请先执行 \`gh auth login\`。"
fi
