#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  die "工作区不干净。请先提交或暂存当前改动，再执行发布。"
fi
