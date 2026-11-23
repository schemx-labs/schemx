#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  die "正式发布只能在 main 分支执行。当前分支：$branch"
fi
