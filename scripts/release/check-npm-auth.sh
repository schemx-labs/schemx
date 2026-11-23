#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

info "检查 npm 登录状态"
configure_npm_token_auth
if ! pnpm whoami --registry "$NPM_REGISTRY" >/dev/null 2>&1; then
  printf -v login_hint 'pnpm login --registry "%s"' "$NPM_REGISTRY"
  die "$(cat <<MESSAGE
npm 未登录或当前 registry 无权限。

可选处理方式：
- 推荐：设置 NPM_TOKEN 后重新执行发布命令。
- 或执行：\`$login_hint\`

pnpm login 可能会打开 npm 网页认证或显示二维码。
完成浏览器确认后，请回到终端等待命令继续。
MESSAGE
)"
fi
