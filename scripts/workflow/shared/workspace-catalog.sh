#!/usr/bin/env bash

# workspace 目录发现。
# 公开函数：workspace_catalog_discover。

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/package-json.sh"

workspace_catalog_discover() {
  local root_dir="$1"
  shift
  local scope
  local package_file
  local directory
  local package_name

  package_json_require_jq || return
  for scope in "$@"; do
    [[ -d "$root_dir/$scope" ]] || continue
    while IFS= read -r package_file; do
      directory="$(basename "$(dirname "$package_file")")"
      package_name="$(package_json_name "$package_file")" || return
      [[ -n "$package_name" ]] || continue
      printf '%s\t%s\t%s\t%s\n' "$scope" "$directory" "$package_name" "$package_file"
    done < <(find "$root_dir/$scope" -mindepth 2 -maxdepth 2 -name package.json -type f -print | LC_ALL=C sort)
  done
}
