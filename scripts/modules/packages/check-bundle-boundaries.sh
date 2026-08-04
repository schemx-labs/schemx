#!/usr/bin/env bash

# 构建产物边界检查：确保 external import 保留且声明文件不回指 workspace 源码。

set -o pipefail

module_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$module_root/lib/ui.sh"
bundle_root="${1:-$(cd "$module_root/.." && pwd)}"
bundle_failures=()

bundle_add_failure() {
  bundle_failures+=("$1")
}

bundle_require_file() {
  local relative_path="$1"
  [[ -f "$bundle_root/$relative_path" ]] || {
    bundle_add_failure "${relative_path}: 文件不存在"
    return 1
  }
}

# 同时匹配静态 import、动态 import 与 CommonJS require 的裸依赖引用。
bundle_has_bare_specifier() {
  local relative_path="$1"
  local specifier="$2"
  local allow_subpath="${3:-false}"
  local suffix=''
  local pattern

  [[ "$allow_subpath" == true ]] && suffix="(?:/[^\"']*)?"
  pattern="\\b(?:from\\s*[\"']\\Q${specifier}\\E${suffix}[\"']|import\\s*\\(\\s*[\"']\\Q${specifier}\\E${suffix}[\"']\\s*\\)|require\\s*\\(\\s*[\"']\\Q${specifier}\\E${suffix}[\"']\\s*\\))"
  rg -q --pcre2 "$pattern" "$bundle_root/$relative_path"
}

bundle_is_unavailable_placeholder() {
  rg -q -F 'validatorAdapterUnavailable(' "$bundle_root/$1"
}

bundle_check_js() {
  local relative_path="$1"
  shift
  local mode='required'
  local specifier
  local required=()
  local required_when_implemented=()
  local forbidden=()

  bundle_require_file "$relative_path" || return
  for specifier in "$@"; do
    case "$specifier" in
      --required-when-implemented) mode='required_when_implemented' ;;
      --forbidden) mode='forbidden' ;;
      *)
        case "$mode" in
          required) required+=("$specifier") ;;
          required_when_implemented) required_when_implemented+=("$specifier") ;;
          forbidden) forbidden+=("$specifier") ;;
        esac
        ;;
    esac
  done
  if ! bundle_is_unavailable_placeholder "$relative_path"; then
    required+=("${required_when_implemented[@]}")
  fi
  for specifier in "${required[@]}"; do
    bundle_has_bare_specifier "$relative_path" "$specifier" || bundle_add_failure "${relative_path}: 缺少 ${specifier}"
  done
  for specifier in "${forbidden[@]}"; do
    bundle_has_bare_specifier "$relative_path" "$specifier" true && bundle_add_failure "${relative_path}: 泄漏 ${specifier}"
  done
}

bundle_check_declaration() {
  local relative_path="$1"
  local implementation_path="$2"
  shift 2
  local mode='required'
  local specifier
  local source
  local required=()
  local required_when_implemented=()
  local forbidden=()

  bundle_require_file "$relative_path" || return
  source="$(<"$bundle_root/$relative_path")"
  for specifier in "$@"; do
    case "$specifier" in
      --required-when-implemented) mode='required_when_implemented' ;;
      --forbidden) mode='forbidden' ;;
      *)
        case "$mode" in
          required) required+=("$specifier") ;;
          required_when_implemented) required_when_implemented+=("$specifier") ;;
          forbidden) forbidden+=("$specifier") ;;
        esac
        ;;
    esac
  done
  if [[ -n "$implementation_path" ]] && bundle_require_file "$implementation_path" && ! bundle_is_unavailable_placeholder "$implementation_path"; then
    required+=("${required_when_implemented[@]}")
  fi
  for specifier in "${required[@]}"; do
    [[ "$source" == *"$specifier"* ]] || bundle_add_failure "${relative_path}: 类型声明缺少 ${specifier}"
  done
  for specifier in "${forbidden[@]}"; do
    [[ "$source" == *"$specifier"* ]] && bundle_add_failure "${relative_path}: 类型声明泄漏 ${specifier}"
  done
}

bundle_check_main() {
  bundle_check_js packages/validator/dist/index.mjs --forbidden @schemx/core zod async-validator
  bundle_check_js packages/validator/dist/index.cjs --forbidden @schemx/core zod async-validator
  bundle_check_js packages/validator/dist/zod.mjs --forbidden async-validator
  bundle_check_js packages/validator/dist/zod.cjs --forbidden async-validator
  bundle_check_js packages/validator/dist/async-validator.mjs --required-when-implemented async-validator --forbidden zod
  bundle_check_js packages/validator/dist/async-validator.cjs --required-when-implemented async-validator --forbidden zod
  bundle_check_js packages/validator/dist/preset.mjs
  bundle_check_js packages/validator/dist/preset.cjs
  bundle_check_js packages/core/dist/index.mjs es-toolkit es-toolkit/compat @preact/signals-core
  bundle_check_js packages/core/dist/index.cjs es-toolkit es-toolkit/compat @preact/signals-core
  bundle_check_js packages/vue/dist/index.mjs @schemx/core classnames es-toolkit --forbidden simple-async-context @preact/signals-core
  bundle_check_js packages/vue/dist/index.cjs @schemx/core classnames es-toolkit --forbidden simple-async-context @preact/signals-core
  bundle_check_js packages/vant/dist/index.mjs @schemx/vue classnames dayjs es-toolkit --forbidden simple-async-context @preact/signals-core
  bundle_check_js packages/vant/dist/index.cjs @schemx/vue classnames dayjs es-toolkit --forbidden simple-async-context @preact/signals-core

  bundle_check_declaration packages/validator/dist/zod.d.ts packages/validator/dist/zod.mjs --required-when-implemented @schemx/core --forbidden ../../core/src ../../core/dist
  bundle_check_declaration packages/validator/dist/async-validator.d.ts packages/validator/dist/async-validator.mjs --required-when-implemented @schemx/core --forbidden ../../core/src ../../core/dist
  bundle_check_declaration packages/validator/dist/preset.d.ts '' --forbidden ../../core/src ../../core/dist
  bundle_check_declaration packages/vant/dist/index.d.ts '' @schemx/vue @schemx/core --forbidden ../../vue/src ../../core/src

  if [[ "${#bundle_failures[@]}" -gt 0 ]]; then
    ui_status error '包产物未保留依赖式 external 边界：'
    for failure in "${bundle_failures[@]}"; do
      ui_note "$failure"
    done
    return 1
  fi
}

bundle_check_main "$@"
