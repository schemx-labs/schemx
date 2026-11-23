#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

target_filters=()

if [[ "$#" -gt 0 ]]; then
  for pkg in "$@"; do
    # 发布单包时仍检查依赖链，避免下游包在本地工作区引用到未通过验证的变更。
    target_filters+=(--filter "@schemx/$pkg...")
  done
fi

info "安装依赖一致性检查"
pnpm install --frozen-lockfile

if [[ "${#target_filters[@]}" -gt 0 ]]; then
  info "运行目标依赖链测试：$(target_summary "$@")"
  pnpm "${target_filters[@]}" test
else
  info "运行测试"
  pnpm test
fi

if [[ "${#target_filters[@]}" -gt 0 ]]; then
  info "运行目标依赖链 lint：$(target_summary "$@")"
  pnpm "${target_filters[@]}" lint
else
  info "运行 lint"
  pnpm lint
fi

if [[ "${#target_filters[@]}" -gt 0 ]]; then
  info "构建目标依赖链发布产物：$(target_summary "$@")"
  pnpm "${target_filters[@]}" build
else
  info "构建发布产物"
  pnpm build
fi
