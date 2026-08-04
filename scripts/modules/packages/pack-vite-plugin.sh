#!/usr/bin/env bash
set -euo pipefail

# 将指定 Vite 插件以带时间戳的本地版本打包到 .packs 目录。
# 用法：bash scripts/modules/packages/pack-vite-plugin.sh <插件目录名> [版本后缀]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
source "$ROOT/scripts/lib/ui.sh"
PLUGIN_KEY="${1:-}"
SUFFIX="${2:-dev}"

plugin_ui_enabled() {
  [[ "${SCHEMX_WORKFLOW_SILENT:-false}" != 'true' ]]
}

plugin_ui() {
  if ! plugin_ui_enabled; then
    case "${1:-}" in
      ui_task | ui_service)
        shift
        while [[ $# -gt 0 && "$1" != '--' ]]; do
          shift
        done
        [[ "${1:-}" == '--' && $# -gt 1 ]] || return 2
        shift
        "$@"
        return
        ;;
      *)
        return 0
        ;;
    esac
  fi
  "$@"
}

case "$PLUGIN_KEY" in
  vite-plugin-workspace-source | vite-plugin-package-resolution-compat | vite-plugin-realpath-fallback)
    ;;
  *)
    plugin_ui ui_status error "未知 Vite 插件：$PLUGIN_KEY"
    exit 1
    ;;
esac

PACKS_DIR="$ROOT/.packs"
PLUGIN_DIR="$ROOT/plugins/$PLUGIN_KEY"
PACKAGE_JSON="$PLUGIN_DIR/package.json"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

read_package_field() {
  local field="$1"

  node -e "
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
process.stdout.write(pkg[process.argv[2]]);
" "$PACKAGE_JSON" "$field"
}

write_version() {
  local version="$1"

  node -e "
const fs = require('node:fs');
const path = process.argv[1];
const version = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = version;
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
" "$PACKAGE_JSON" "$version"
}

PLUGIN_NAME="$(read_package_field name)"
ORIGINAL_VERSION="$(read_package_field version)"
PACK_VERSION="${ORIGINAL_VERSION}-${SUFFIX}.${TIMESTAMP}"

restore_version() {
  write_version "$ORIGINAL_VERSION"
}
trap restore_version EXIT

mkdir -p "$PACKS_DIR"

plugin_ui ui_flow_begin --domain tools --title '本地插件打包' --description "为 ${PLUGIN_NAME} 生成带时间戳的 tarball。"
plugin_ui ui_note "输出目录：${PACKS_DIR}"

write_version "$PACK_VERSION"

cd "$PLUGIN_DIR"
if plugin_ui ui_task --title "构建 ${PLUGIN_NAME}" --log live -- pnpm build; then
  :
else
  exit_code=$?
  plugin_ui ui_flow_end failed "构建 ${PLUGIN_NAME} 失败。"
  exit "$exit_code"
fi
if plugin_ui ui_task --title "打包 ${PLUGIN_NAME}" --log live -- env CI=true pnpm pack --pack-destination "$PACKS_DIR"; then
  :
else
  exit_code=$?
  plugin_ui ui_flow_end failed "打包 ${PLUGIN_NAME} 失败。"
  exit "$exit_code"
fi

TARBALL_PATH="$(find "$PACKS_DIR" -maxdepth 1 -type f -name "*-${PACK_VERSION}.tgz" -print -quit)"

if [[ -z "$TARBALL_PATH" ]]; then
  plugin_ui ui_status error "未找到本次打包产物：$PACK_VERSION"
  exit 1
fi

plugin_ui ui_flow_end success "打包完成：$TARBALL_PATH"
printf '__SCHEMX_LOCAL_TARBALL__=%s\n' "$TARBALL_PATH"
