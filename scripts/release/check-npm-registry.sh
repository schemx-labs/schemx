#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

info "检查 npm registry"
configured_registry="$(pnpm config get registry)"
printf '当前 registry：%s\n' "$configured_registry"
printf '发布 registry：%s\n' "$NPM_REGISTRY"
