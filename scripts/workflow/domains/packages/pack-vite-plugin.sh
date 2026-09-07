#!/usr/bin/env bash
set -euo pipefail

# Vite 插件本地打包领域逻辑。
# 公开函数：packages_pack_vite_plugin。
# 内部函数：packages__plugin_*。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
source "$ROOT/scripts/workflow/ui/api.sh"
packages__plugin_ui_enabled() {
  [[ "${SCHEMX_WORKFLOW_SILENT:-false}" != 'true' ]]
}

packages__plugin_ui() {
  if ! packages__plugin_ui_enabled; then
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

PACKS_DIR="$ROOT/.packs"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

packages__plugin_read_field() {
  local field="$1"

  node -e "
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
process.stdout.write(pkg[process.argv[2]]);
" "$PACKAGE_JSON" "$field"
}

packages__plugin_write_version() {
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

packages__plugin_restore_version() {
  packages__plugin_write_version "$1"
}

packages_pack_vite_plugin() {
  local plugin_key="${1:-}"
  local suffix="${2:-dev}"
  local plugin_name
  local pack_version
  local tarball_path
  local exit_code

  case "$plugin_key" in
    vite-plugin-workspace-source | vite-plugin-package-resolution-compat | vite-plugin-realpath-fallback)
      ;;
    *)
      packages__plugin_ui ui_status error "未知 Vite 插件：$plugin_key"
      return 1
      ;;
  esac

  PLUGIN_KEY="$plugin_key"
  SUFFIX="$suffix"
  PLUGIN_DIR="$ROOT/plugins/$PLUGIN_KEY"
  PACKAGE_JSON="$PLUGIN_DIR/package.json"
  local original_version
  original_version="$(packages__plugin_read_field version)"
  plugin_name="$(packages__plugin_read_field name)"
  pack_version="${original_version}-${SUFFIX}.${TIMESTAMP}"

  mkdir -p "$PACKS_DIR"
  packages__plugin_ui ui_flow_begin --domain tools --title '本地插件打包' --description "为 ${plugin_name} 生成带时间戳的 tarball。"
  packages__plugin_ui ui_note "输出目录：${PACKS_DIR}"
  packages__plugin_write_version "$pack_version"

  cd "$PLUGIN_DIR"
  if packages__plugin_ui ui_task --title "构建 ${plugin_name}" --log live -- pnpm build; then
    :
  else
    exit_code=$?
    packages__plugin_restore_version "$original_version"
    packages__plugin_ui ui_flow_end failed "构建 ${plugin_name} 失败。"
    return "$exit_code"
  fi
  if packages__plugin_ui ui_task --title "打包 ${plugin_name}" --log live -- env CI=true pnpm pack --pack-destination "$PACKS_DIR"; then
    :
  else
    exit_code=$?
    packages__plugin_restore_version "$original_version"
    packages__plugin_ui ui_flow_end failed "打包 ${plugin_name} 失败。"
    return "$exit_code"
  fi

  tarball_path="$(find "$PACKS_DIR" -maxdepth 1 -type f -name "*-${pack_version}.tgz" -print -quit)"
  if [[ -z "$tarball_path" ]]; then
    packages__plugin_restore_version "$original_version"
    packages__plugin_ui ui_status error "未找到本次打包产物：$pack_version"
    return 1
  fi

  packages__plugin_restore_version "$original_version"
  packages__plugin_ui ui_flow_end success "打包完成：$tarball_path"
  if [[ -n "${SCHEMX_PACK_RESULT_FILE:-}" ]]; then
    printf 'directory\t%s\ntarball\t%s\n' "$PACKS_DIR" "$tarball_path" >> "$SCHEMX_PACK_RESULT_FILE"
  else
    printf '__SCHEMX_LOCAL_TARBALL__=%s\n' "$tarball_path"
  fi
}
