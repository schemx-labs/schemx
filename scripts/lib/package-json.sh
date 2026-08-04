#!/usr/bin/env bash

# package.json 的通用读取适配器。

lib_require_jq() {
  command -v jq >/dev/null 2>&1 || {
    printf '缺少 jq，无法读取 package.json 元数据。\n' >&2
    return 127
  }
}
lib_package_name() {
  local package_file="$1"

  lib_require_jq || return
  jq -r '.name // empty' "$package_file"
}

lib_package_has_script() {
  local package_file="$1"
  local script_name="$2"

  lib_require_jq || return
  jq -e --arg script_name "$script_name" '.scripts[$script_name] != null' "$package_file" >/dev/null
}
