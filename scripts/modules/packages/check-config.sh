#!/usr/bin/env bash

# workspace 包配置检查：聚合 peer、环境开关与已废弃构建分支的约束违规项。

set -o pipefail

module_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$module_root/lib/ui.sh"
source "$module_root/lib/package-json.sh"

check_config_root="${1:-$(cd "$module_root/.." && pwd)}"
check_config_failures=()

check_config_add_failure() {
  check_config_failures+=("$1")
}

check_config_require_package_file() {
  local relative_path="$1"
  local file_path="$check_config_root/$relative_path"

  if [[ ! -f "$file_path" ]]; then
    check_config_add_failure "${relative_path}: 文件不存在"
    return 1
  fi
  if ! jq empty "$file_path" >/dev/null 2>&1; then
    check_config_add_failure "${relative_path}: package.json 不是有效 JSON"
    return 1
  fi
}

check_config_package_has() {
  local relative_path="$1"
  local dependency_block="$2"
  local dependency_name="$3"

  jq -e --arg block "$dependency_block" --arg name "$dependency_name" \
    '.[$block][$name] != null' "$check_config_root/$relative_path" >/dev/null
}

check_config_package_peer_optional() {
  local relative_path="$1"
  local dependency_name="$2"

  jq -e --arg name "$dependency_name" \
    '.peerDependenciesMeta[$name].optional == true' "$check_config_root/$relative_path" >/dev/null
}

check_config_validate_internal_peer() {
  local relative_path="$1"
  local dependency_name="$2"

  if ! check_config_package_has "$relative_path" peerDependencies "$dependency_name"; then
    check_config_add_failure "${relative_path}: peerDependencies 缺少 ${dependency_name}"
  fi
  if check_config_package_has "$relative_path" dependencies "$dependency_name"; then
    check_config_add_failure "${relative_path}: dependencies 不应声明 ${dependency_name}"
  fi
  if ! check_config_package_has "$relative_path" devDependencies "$dependency_name"; then
    check_config_add_failure "${relative_path}: devDependencies 缺少本地开发依赖 ${dependency_name}"
  fi
}

check_config_validate_optional_peer() {
  local relative_path="$1"
  local dependency_name="$2"

  if ! check_config_package_has "$relative_path" peerDependencies "$dependency_name"; then
    check_config_add_failure "${relative_path}: peerDependencies 缺少 ${dependency_name}"
  fi
  if ! check_config_package_peer_optional "$relative_path" "$dependency_name"; then
    check_config_add_failure "${relative_path}: ${dependency_name} 必须标记为 optional peer"
  fi
  if ! check_config_package_has "$relative_path" devDependencies "$dependency_name"; then
    check_config_add_failure "${relative_path}: devDependencies 缺少 ${dependency_name}"
  fi
}

check_config_validate_vite_scripts() {
  local relative_path="$1"
  local script_name
  local script_value

  while IFS=$'\t' read -r script_name script_value; do
    [[ -n "$script_name" ]] || continue
    if [[ "$script_value" =~ (^|[[:space:]])VITE_[A-Z0-9_]+= ]]; then
      check_config_add_failure "${relative_path}: scripts.${script_name} 不应内联 VITE_* 环境变量"
    fi
  done < <(jq -r '.scripts // {} | to_entries[] | [.key, .value] | @tsv' "$check_config_root/$relative_path")
}

check_config_validate_required_text() {
  local relative_path="$1"
  shift
  local source
  local required

  if [[ ! -f "$check_config_root/$relative_path" ]]; then
    check_config_add_failure "${relative_path}: 文件不存在"
    return
  fi
  source="$(<"$check_config_root/$relative_path")"
  for required in "$@"; do
    if [[ "$source" != *"$required"* ]]; then
      check_config_add_failure "${relative_path}: 缺少 ${required}"
    fi
  done
}

check_config_validate_forbidden_text() {
  local relative_path="$1"
  shift
  local source
  local forbidden

  if [[ ! -f "$check_config_root/$relative_path" ]]; then
    check_config_add_failure "${relative_path}: 文件不存在"
    return
  fi
  source="$(<"$check_config_root/$relative_path")"
  for forbidden in "$@"; do
    if [[ "$source" == *"$forbidden"* ]]; then
      check_config_add_failure "${relative_path}: 不应包含 standalone 逻辑 ${forbidden}"
    fi
  done
}

check_config_main() {
  local package_file

  lib_require_jq || return
  for package_file in \
    packages/validator/package.json \
    packages/vue/package.json \
    packages/vant/package.json \
    packages/core/package.json; do
    check_config_require_package_file "$package_file"
  done
  if [[ "${#check_config_failures[@]}" -eq 0 ]]; then
    check_config_validate_internal_peer packages/validator/package.json @schemx/core
    check_config_validate_internal_peer packages/vue/package.json @schemx/core
    check_config_validate_internal_peer packages/vant/package.json @schemx/core
    check_config_validate_internal_peer packages/vant/package.json @schemx/vue
    check_config_validate_optional_peer packages/validator/package.json async-validator

    for package_file in \
      packages/core/package.json \
      packages/validator/package.json \
      packages/vue/package.json \
      packages/vant/package.json; do
      check_config_validate_vite_scripts "$package_file"
    done
  fi

  check_config_validate_required_text packages/core/.env VITE_ANALYZE=
  check_config_validate_required_text packages/vue/.env VITE_USE_SOURCE= VITE_ANALYZE=
  check_config_validate_required_text packages/vant/.env VITE_USE_SOURCE= VITE_ANALYZE=
  check_config_validate_forbidden_text packages/vant/package.json standalone normalize-vant-dts '--mode standalone'
  check_config_validate_forbidden_text packages/vant/.env VITE_BUILD_STANDALONE
  check_config_validate_forbidden_text .gitignore packages/vant/.env.standalone

  if [[ "${#check_config_failures[@]}" -gt 0 ]]; then
    ui_status error '包配置检查失败：'
    for failure in "${check_config_failures[@]}"; do
      ui_note "$failure"
    done
    return 1
  fi
}

check_config_main "$@"
