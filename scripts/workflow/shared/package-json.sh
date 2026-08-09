#!/usr/bin/env bash

# package.json 通用能力。
# 公开函数：package_json_require_jq、package_json_name、package_json_has_script。

package_json_require_jq() {
  command -v jq >/dev/null 2>&1 || {
    printf '缺少 jq，无法读取 package.json 元数据。\n' >&2
    return 127
  }
}
package_json_name() {
  local package_file="$1"

  package_json_require_jq || return
  jq -r '.name // empty' "$package_file"
}

package_json_has_script() {
  local package_file="$1"
  local script_name="$2"

  package_json_require_jq || return
  jq -e --arg script_name "$script_name" '.scripts[$script_name] != null' "$package_file" >/dev/null
}
