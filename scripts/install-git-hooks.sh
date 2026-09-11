#!/usr/bin/env bash

# 配置当前仓库使用版本化 Git hooks。
# 副作用：写入当前仓库的 local core.hooksPath；非 Git 目录中直接跳过。
# 退出码：配置成功或不在 Git 仓库时返回 0，Git 配置失败时返回非 0。

set -euo pipefail

hooks_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! git -C "$hooks_root" rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

git -C "$hooks_root" config --local core.hooksPath .githooks
printf '%s\n' '已配置 Git hooks：.githooks'
