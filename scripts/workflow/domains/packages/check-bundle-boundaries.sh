#!/usr/bin/env bash

# 构建产物边界检查领域逻辑。
# 公开函数：packages_check_bundle_boundaries。
# 内部函数：packages__bundle_*。

set -o pipefail

module_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$module_root/ui/api.sh"
packages__bundle_add_failure() {
  packages__bundle_failures+=("$1")
}

packages__bundle_require_file() {
  local relative_path="$1"
  [[ -f "$packages__bundle_root/$relative_path" ]] || {
    packages__bundle_add_failure "${relative_path}: 文件不存在"
    return 1
  }
}

# 同时匹配静态 import、动态 import 与 CommonJS require 的裸依赖引用。
packages__bundle_has_bare_specifier() {
  local relative_path="$1"
  local specifier="$2"
  local allow_subpath="${3:-false}"
  local suffix=''
  local pattern

  [[ "$allow_subpath" == true ]] && suffix="(?:/[^\"']*)?"
  pattern="\\b(?:from\\s*[\"']\\Q${specifier}\\E${suffix}[\"']|import\\s*\\(\\s*[\"']\\Q${specifier}\\E${suffix}[\"']\\s*\\)|require\\s*\\(\\s*[\"']\\Q${specifier}\\E${suffix}[\"']\\s*\\))"
  rg -q --pcre2 "$pattern" "$packages__bundle_root/$relative_path"
}

packages__bundle_check_js() {
  local relative_path="$1"
  shift
  local mode='required'
  local specifier
  local required=()
  local forbidden=()

  packages__bundle_require_file "$relative_path" || return
  for specifier in "$@"; do
    case "$specifier" in
      --forbidden) mode='forbidden' ;;
      *)
        case "$mode" in
          required) required+=("$specifier") ;;
          forbidden) forbidden+=("$specifier") ;;
        esac
        ;;
    esac
  done
  for specifier in "${required[@]}"; do
    if ! packages__bundle_has_bare_specifier "$relative_path" "$specifier"; then
      packages__bundle_add_failure "${relative_path}: 缺少 ${specifier}"
    fi
  done
  for specifier in "${forbidden[@]:-}"; do
    if packages__bundle_has_bare_specifier "$relative_path" "$specifier" true; then
      packages__bundle_add_failure "${relative_path}: 泄漏 ${specifier}"
    fi
  done
}

packages__bundle_check_declaration() {
  local relative_path="$1"
  local implementation_path="$2"
  shift 2
  local mode='required'
  local specifier
  local source
  local required=()
  local forbidden=()

  packages__bundle_require_file "$relative_path" || return
  source="$(<"$packages__bundle_root/$relative_path")"
  for specifier in "$@"; do
    case "$specifier" in
      --forbidden) mode='forbidden' ;;
      *)
        case "$mode" in
          required) required+=("$specifier") ;;
          forbidden) forbidden+=("$specifier") ;;
        esac
        ;;
    esac
  done
  for specifier in "${required[@]}"; do
    if [[ "$source" != *"$specifier"* ]]; then
      packages__bundle_add_failure "${relative_path}: 类型声明缺少 ${specifier}"
    fi
  done
  for specifier in "${forbidden[@]:-}"; do
    if [[ "$source" == *"$specifier"* ]]; then
      packages__bundle_add_failure "${relative_path}: 类型声明泄漏 ${specifier}"
    fi
  done
}

packages_check_bundle_boundaries() {
  packages__bundle_root="${1:-$(cd "$module_root/../.." && pwd)}"
  packages__bundle_failures=()
  packages__bundle_check_js packages/core/dist/index.mjs async-validator --forbidden @schemx/validator
  packages__bundle_check_js packages/core/dist/index.cjs async-validator --forbidden @schemx/validator
  packages__bundle_check_js packages/core/dist/index.mjs es-toolkit es-toolkit/compat @preact/signals-core
  packages__bundle_check_js packages/core/dist/index.cjs es-toolkit es-toolkit/compat @preact/signals-core
  packages__bundle_check_js packages/vue/dist/index.mjs @schemx/core classnames es-toolkit --forbidden simple-async-context @preact/signals-core
  packages__bundle_check_js packages/vue/dist/index.cjs @schemx/core classnames es-toolkit --forbidden simple-async-context @preact/signals-core
  packages__bundle_check_js packages/vant/dist/index.mjs @schemx/vue classnames dayjs es-toolkit --forbidden simple-async-context @preact/signals-core
  packages__bundle_check_js packages/vant/dist/index.cjs @schemx/vue classnames dayjs es-toolkit --forbidden simple-async-context @preact/signals-core

  packages__bundle_check_declaration packages/vant/dist/index.d.ts '' @schemx/vue @schemx/core --forbidden ../../vue/src ../../core/src

  if [[ "${#packages__bundle_failures[@]}" -gt 0 ]]; then
    ui_status error '包产物未保留依赖式 external 边界：'
    for failure in "${packages__bundle_failures[@]}"; do
      ui_note "$failure"
    done
    return 1
  fi
}
