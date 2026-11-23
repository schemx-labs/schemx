#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少要检查发布内容的包名。"
fi

for pkg in "$@"; do
  pnpm --filter "@schemx/$pkg" pack --dry-run
done
