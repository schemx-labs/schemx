#!/usr/bin/env bash

# workspace 包配置检查领域逻辑。
# 公开函数：packages_check_config。
# 内部函数：packages__config_*。

set -o pipefail

module_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$module_root/ui/api.sh"
source "$module_root/shared/package-json.sh"

packages__config_add_failure() {
  packages__config_failures+=("$1")
}

packages__config_require_package_file() {
  local relative_path="$1"
  local file_path="$packages__config_root/$relative_path"

  if [[ ! -f "$file_path" ]]; then
    packages__config_add_failure "${relative_path}: 文件不存在"
    return 1
  fi
  if ! jq empty "$file_path" >/dev/null 2>&1; then
    packages__config_add_failure "${relative_path}: package.json 不是有效 JSON"
    return 1
  fi
}

packages__config_package_has() {
  local relative_path="$1"
  local dependency_block="$2"
  local dependency_name="$3"

  jq -e --arg block "$dependency_block" --arg name "$dependency_name" \
    '.[$block][$name] != null' "$packages__config_root/$relative_path" >/dev/null
}

packages__config_package_has_specifier() {
  local relative_path="$1"
  local dependency_block="$2"
  local dependency_name="$3"
  local expected_specifier="$4"

  jq -e --arg block "$dependency_block" --arg name "$dependency_name" --arg specifier "$expected_specifier" \
    '.[$block][$name] == $specifier' "$packages__config_root/$relative_path" >/dev/null
}

packages__config_package_peer_optional() {
  local relative_path="$1"
  local dependency_name="$2"

  jq -e --arg name "$dependency_name" \
    '.peerDependenciesMeta[$name].optional == true' "$packages__config_root/$relative_path" >/dev/null
}

packages__config_validate_internal_dependency() {
  local relative_path="$1"
  local dependency_name="$2"

  if ! packages__config_package_has "$relative_path" dependencies "$dependency_name"; then
    packages__config_add_failure "${relative_path}: dependencies 缺少 ${dependency_name}"
  elif ! packages__config_package_has_specifier "$relative_path" dependencies "$dependency_name" 'workspace:*'; then
    packages__config_add_failure "${relative_path}: dependencies.${dependency_name} 必须为 workspace:*"
  fi
  if packages__config_package_has "$relative_path" peerDependencies "$dependency_name"; then
    packages__config_add_failure "${relative_path}: peerDependencies 不应声明 ${dependency_name}"
  fi
  if packages__config_package_has "$relative_path" devDependencies "$dependency_name"; then
    packages__config_add_failure "${relative_path}: devDependencies 不应重复声明 ${dependency_name}"
  fi
}

packages__config_validate_optional_peer() {
  local relative_path="$1"
  local dependency_name="$2"

  if ! packages__config_package_has "$relative_path" peerDependencies "$dependency_name"; then
    packages__config_add_failure "${relative_path}: peerDependencies 缺少 ${dependency_name}"
  fi
  if ! packages__config_package_peer_optional "$relative_path" "$dependency_name"; then
    packages__config_add_failure "${relative_path}: ${dependency_name} 必须标记为 optional peer"
  fi
  if ! packages__config_package_has "$relative_path" devDependencies "$dependency_name"; then
    packages__config_add_failure "${relative_path}: devDependencies 缺少 ${dependency_name}"
  fi
}

packages__config_validate_vite_scripts() {
  local relative_path="$1"
  local script_name
  local script_value

  while IFS=$'\t' read -r script_name script_value; do
    [[ -n "$script_name" ]] || continue
    if [[ "$script_value" =~ (^|[[:space:]])VITE_[A-Z0-9_]+= ]]; then
      packages__config_add_failure "${relative_path}: scripts.${script_name} 不应内联 VITE_* 环境变量"
    fi
  done < <(jq -r '.scripts // {} | to_entries[] | [.key, .value] | @tsv' "$packages__config_root/$relative_path")
}

packages__config_validate_required_text() {
  local relative_path="$1"
  shift
  local source
  local required

  if [[ ! -f "$packages__config_root/$relative_path" ]]; then
    packages__config_add_failure "${relative_path}: 文件不存在"
    return
  fi
  source="$(<"$packages__config_root/$relative_path")"
  for required in "$@"; do
    if [[ "$source" != *"$required"* ]]; then
      packages__config_add_failure "${relative_path}: 缺少 ${required}"
    fi
  done
}

packages__config_validate_forbidden_text() {
  local relative_path="$1"
  shift
  local source
  local forbidden

  if [[ ! -f "$packages__config_root/$relative_path" ]]; then
    packages__config_add_failure "${relative_path}: 文件不存在"
    return
  fi
  source="$(<"$packages__config_root/$relative_path")"
  for forbidden in "$@"; do
    if [[ "$source" == *"$forbidden"* ]]; then
      packages__config_add_failure "${relative_path}: 不应包含 standalone 逻辑 ${forbidden}"
    fi
  done
}

packages_check_config() {
  local package_file

  packages__config_root="${1:-$(cd "$module_root/../.." && pwd)}"
  packages__config_failures=()
  package_json_require_jq || return
  for package_file in \
    packages/vue/package.json \
    packages/vant/package.json \
    packages/element-plus/package.json \
    packages/core/package.json; do
    packages__config_require_package_file "$package_file"
  done
  if [[ "${#packages__config_failures[@]}" -eq 0 ]]; then
    packages__config_validate_internal_dependency packages/vue/package.json @schemx/core
    packages__config_validate_internal_dependency packages/vant/package.json @schemx/core
    packages__config_validate_internal_dependency packages/vant/package.json @schemx/vue
    packages__config_validate_internal_dependency packages/element-plus/package.json @schemx/core
    packages__config_validate_internal_dependency packages/element-plus/package.json @schemx/vue
    for package_file in \
      packages/core/package.json \
      packages/vue/package.json \
      packages/vant/package.json \
      packages/element-plus/package.json; do
      packages__config_validate_vite_scripts "$package_file"
    done
  fi

  packages__config_validate_required_text packages/core/.env VITE_ANALYZE=
  packages__config_validate_required_text packages/vue/.env VITE_USE_SOURCE= VITE_ANALYZE=
  packages__config_validate_required_text packages/vant/.env VITE_USE_SOURCE= VITE_ANALYZE=
  packages__config_validate_required_text packages/element-plus/.env VITE_USE_SOURCE= VITE_ANALYZE=
  packages__config_validate_forbidden_text packages/vant/package.json standalone normalize-vant-dts '--mode standalone'
  packages__config_validate_forbidden_text packages/vant/.env VITE_BUILD_STANDALONE
  packages__config_validate_forbidden_text .gitignore packages/vant/.env.standalone

  if [[ "${#packages__config_failures[@]}" -gt 0 ]]; then
    ui_status error '包配置检查失败：'
    for failure in "${packages__config_failures[@]}"; do
      ui_note "$failure"
    done
    return 1
  fi
}
