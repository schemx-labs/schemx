#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
RELEASE_PACKAGES=(core vue vant)

# 颜色只面向交互终端；CI 和 NO_COLOR 环境保持纯文本，避免污染日志。
release_colors_enabled() {
  if [[ -n "${NO_COLOR:-}" ]]; then
    return 1
  fi

  if [[ -n "${FORCE_COLOR:-}" && "${FORCE_COLOR:-}" != "0" ]]; then
    return 0
  fi

  if [[ "${CLICOLOR_FORCE:-}" == "1" ]]; then
    return 0
  fi

  [[ -t 1 ]]
}

if release_colors_enabled; then
  RELEASE_COLOR_INFO=$'\033[36m'
  RELEASE_COLOR_SUCCESS=$'\033[32m'
  RELEASE_COLOR_WARN=$'\033[33m'
  RELEASE_COLOR_ERROR=$'\033[31m'
  RELEASE_COLOR_RESET=$'\033[0m'
else
  RELEASE_COLOR_INFO=""
  RELEASE_COLOR_SUCCESS=""
  RELEASE_COLOR_WARN=""
  RELEASE_COLOR_ERROR=""
  RELEASE_COLOR_RESET=""
fi

info() {
  printf '\n%s==> %s%s\n' "$RELEASE_COLOR_INFO" "$1" "$RELEASE_COLOR_RESET"
}

success() {
  printf '%s%s%s\n' "$RELEASE_COLOR_SUCCESS" "$1" "$RELEASE_COLOR_RESET"
}

warn() {
  printf '%s%s%s\n' "$RELEASE_COLOR_WARN" "$1" "$RELEASE_COLOR_RESET"
}

die() {
  printf '%s错误：%s%s\n' "$RELEASE_COLOR_ERROR" "$1" "$RELEASE_COLOR_RESET" >&2
  exit 1
}

package_choices() {
  local IFS="、"
  printf '%s' "${RELEASE_PACKAGES[*]}"
}

package_path() {
  printf 'packages/%s' "$1"
}

package_json_value() {
  local pkg="$1"
  local field="$2"

  node -p "const pkg=require('./$(package_path "$pkg")/package.json'); pkg['$field']"
}

assert_package() {
  local pkg="$1"
  local item

  for item in "${RELEASE_PACKAGES[@]}"; do
    if [[ "$item" == "$pkg" ]]; then
      return
    fi
  done

  die "未知包：$pkg，可选值为 $(package_choices)"
}

assert_publish_target() {
  local target="$1"

  if [[ "$target" == "all" ]]; then
    return
  fi

  assert_package "$target"
}

resolve_targets() {
  local target="${1:-all}"

  if [[ "$target" == "all" ]]; then
    printf '%s\n' "${RELEASE_PACKAGES[@]}"
    return
  fi

  assert_package "$target"
  printf '%s\n' "$target"
}

target_summary() {
  local IFS="、"
  printf '%s' "$*"
}

set_package_version() {
  local pkg_json="$1"
  local version="$2"

  node -e "
const fs = require('node:fs');
const pkgPath = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
" "$pkg_json" "$version"
}

next_prerelease_version() {
  local current_version="$1"
  local channel="$2"
  local base major minor patch timestamp sha

  base="${current_version%%-*}"
  IFS=. read -r major minor patch <<<"$base"

  if [[ -z "${major:-}" || -z "${minor:-}" || -z "${patch:-}" ]]; then
    die "无法解析版本号：$current_version"
  fi

  patch=$((patch + 1))
  timestamp="${SCHEMX_RELEASE_TIMESTAMP:-$(date +%Y%m%d%H%M%S)}"
  sha="${SCHEMX_RELEASE_SHA:-$(git rev-parse --short HEAD 2>/dev/null || printf 'local')}"

  printf '%s.%s.%s-%s.%s.%s' "$major" "$minor" "$patch" "$channel" "$timestamp" "$sha"
}

release_tag_name() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

release_title() {
  local pkg="$1"
  local version

  version="$(package_json_value "$pkg" version)"
  printf '@schemx/%s@%s' "$pkg" "$version"
}

github_repository() {
  local repo="${GITHUB_REPOSITORY:-}"

  if [[ -z "$repo" ]]; then
    repo="$(git config --get remote.origin.url 2>/dev/null || true)"
  fi

  case "$repo" in
    git@github.com:*)
      repo="${repo#git@github.com:}"
      ;;
    ssh://git@github.com/*)
      repo="${repo#ssh://git@github.com/}"
      ;;
    https://github.com/*)
      repo="${repo#https://github.com/}"
      ;;
    http://github.com/*)
      repo="${repo#http://github.com/}"
      ;;
  esac

  repo="${repo%.git}"

  if [[ ! "$repo" =~ ^[^/]+/[^/]+$ ]]; then
    die "无法从 origin remote 解析 GitHub 仓库，请设置 GITHUB_REPOSITORY=owner/repo。"
  fi

  printf '%s' "$repo"
}

npm_registry_auth_key() {
  local registry="$1"

  registry="${registry#http://}"
  registry="${registry#https://}"
  registry="${registry%/}/"

  printf '//%s:_authToken' "$registry"
}

configure_npm_token_auth() {
  local npm_token="${NPM_TOKEN:-}"
  local auth_key user_config

  if [[ -z "$npm_token" ]]; then
    return 0
  fi

  if [[ -n "${SCHEMX_NPM_TOKEN_USERCONFIG:-}" ]]; then
    export NPM_CONFIG_USERCONFIG="$SCHEMX_NPM_TOKEN_USERCONFIG"
    return 0
  fi

  auth_key="$(npm_registry_auth_key "$NPM_REGISTRY")"
  user_config="$(mktemp "${TMPDIR:-/tmp}/schemx-npmrc.XXXXXX")"

  {
    printf 'registry=%s\n' "$NPM_REGISTRY"
    printf '%s=%s\n' "$auth_key" "$npm_token"
    printf 'always-auth=true\n'
  } >"$user_config"

  export SCHEMX_NPM_TOKEN_USERCONFIG="$user_config"
  export NPM_CONFIG_USERCONFIG="$user_config"
}
