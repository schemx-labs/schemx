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

packages__bundle_is_unavailable_placeholder() {
  rg -q -F 'validatorAdapterUnavailable(' "$packages__bundle_root/$1"
}

packages__bundle_check_js() {
  local relative_path="$1"
  shift
  local mode='required'
  local specifier
  local has_required_when_implemented=false
  local required=()
  local required_when_implemented=()
  local forbidden=()

  packages__bundle_require_file "$relative_path" || return
  for specifier in "$@"; do
    case "$specifier" in
      --required-when-implemented) mode='required_when_implemented' ;;
      --forbidden) mode='forbidden' ;;
      *)
        case "$mode" in
          required) required+=("$specifier") ;;
          required_when_implemented)
            required_when_implemented+=("$specifier")
            has_required_when_implemented=true
            ;;
          forbidden) forbidden+=("$specifier") ;;
        esac
        ;;
    esac
  done
  if [[ "$has_required_when_implemented" == true ]] && ! packages__bundle_is_unavailable_placeholder "$relative_path"; then
    required+=("${required_when_implemented[@]}")
  fi
  for specifier in "${required[@]}"; do
    packages__bundle_has_bare_specifier "$relative_path" "$specifier" || packages__bundle_add_failure "${relative_path}: 缺少 ${specifier}"
  done
  for specifier in "${forbidden[@]}"; do
    packages__bundle_has_bare_specifier "$relative_path" "$specifier" true && packages__bundle_add_failure "${relative_path}: 泄漏 ${specifier}"
  done
}

packages__bundle_check_declaration() {
  local relative_path="$1"
  local implementation_path="$2"
  shift 2
  local mode='required'
  local specifier
  local has_required_when_implemented=false
  local source
  local required=()
  local required_when_implemented=()
  local forbidden=()

  packages__bundle_require_file "$relative_path" || return
  source="$(<"$packages__bundle_root/$relative_path")"
  for specifier in "$@"; do
    case "$specifier" in
      --required-when-implemented) mode='required_when_implemented' ;;
      --forbidden) mode='forbidden' ;;
      *)
        case "$mode" in
          required) required+=("$specifier") ;;
          required_when_implemented)
            required_when_implemented+=("$specifier")
            has_required_when_implemented=true
            ;;
          forbidden) forbidden+=("$specifier") ;;
        esac
        ;;
    esac
  done
  if [[ "$has_required_when_implemented" == true && -n "$implementation_path" ]] && packages__bundle_require_file "$implementation_path" && ! packages__bundle_is_unavailable_placeholder "$implementation_path"; then
    required+=("${required_when_implemented[@]}")
  fi
  for specifier in "${required[@]}"; do
    [[ "$source" == *"$specifier"* ]] || packages__bundle_add_failure "${relative_path}: 类型声明缺少 ${specifier}"
  done
  for specifier in "${forbidden[@]}"; do
    [[ "$source" == *"$specifier"* ]] && packages__bundle_add_failure "${relative_path}: 类型声明泄漏 ${specifier}"
  done
}

packages_check_bundle_boundaries() {
  packages__bundle_root="${1:-$(cd "$module_root/../.." && pwd)}"
  packages__bundle_failures=()
  packages__bundle_check_js packages/validator/dist/index.mjs async-validator --forbidden @schemx/core zod
  packages__bundle_check_js packages/validator/dist/index.cjs async-validator --forbidden @schemx/core zod
  packages__bundle_check_js packages/core/dist/index.mjs es-toolkit es-toolkit/compat @preact/signals-core
  packages__bundle_check_js packages/core/dist/index.cjs es-toolkit es-toolkit/compat @preact/signals-core
  packages__bundle_check_js packages/vue/dist/index.mjs @schemx/core classnames es-toolkit --forbidden simple-async-context @preact/signals-core
  packages__bundle_check_js packages/vue/dist/index.cjs @schemx/core classnames es-toolkit --forbidden simple-async-context @preact/signals-core
  packages__bundle_check_js packages/vant/dist/index.mjs @schemx/vue classnames dayjs es-toolkit --forbidden simple-async-context @preact/signals-core
  packages__bundle_check_js packages/vant/dist/index.cjs @schemx/vue classnames dayjs es-toolkit --forbidden simple-async-context @preact/signals-core

  packages__bundle_check_declaration packages/validator/dist/async-validator.d.ts '' @schemx/core async-validator --forbidden ../../core/src ../../core/dist
  packages__bundle_check_declaration packages/vant/dist/index.d.ts '' @schemx/vue @schemx/core --forbidden ../../vue/src ../../core/src

  if [[ "${#packages__bundle_failures[@]}" -gt 0 ]]; then
    ui_status error '包产物未保留依赖式 external 边界：'
    for failure in "${packages__bundle_failures[@]}"; do
      ui_note "$failure"
    done
    return 1
  fi
}
