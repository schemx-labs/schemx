#!/usr/bin/env bash

# 跨命令域的 workspace 目标发现；只读取 package.json，不理解具体业务任务。

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/package-json.sh"

lib_discover_workspace_targets() {
  local root_dir="$1"
  shift
  local scope
  local package_file
  local directory
  local package_name

  lib_require_jq || return
  for scope in "$@"; do
    [[ -d "$root_dir/$scope" ]] || continue
    while IFS= read -r package_file; do
      directory="$(basename "$(dirname "$package_file")")"
      package_name="$(lib_package_name "$package_file")" || return
      [[ -n "$package_name" ]] || continue
      printf '%s\t%s\t%s\t%s\n' "$scope" "$directory" "$package_name" "$package_file"
    done < <(find "$root_dir/$scope" -mindepth 2 -maxdepth 2 -name package.json -type f -print | LC_ALL=C sort)
  done
}
