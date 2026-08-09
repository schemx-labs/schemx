#!/usr/bin/env bash

# 发布目标解析。发现 packages 与 plugins 下公开的 workspace 包，不渲染终端也不执行发布命令。

targets_root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# 按稳定顺序输出可发布目标：逻辑名、相对目录和 npm 包名。
targets_records() {
  node - "$targets_root_dir" <<'NODE'
const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const rootDir = process.argv[2]

for (const scope of ['packages', 'plugins']) {
  const scopeDir = join(rootDir, scope)
  let entries = []

  try {
    entries = readdirSync(scopeDir, { withFileTypes: true })
  } catch {
    continue
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue

    try {
      const pkg = JSON.parse(readFileSync(join(scopeDir, entry.name, 'package.json'), 'utf8'))
      if (pkg.private === true || !pkg.name || !pkg.version) continue
      process.stdout.write(`${entry.name}\t${scope}/${entry.name}\t${pkg.name}\n`)
    } catch {
      continue
    }
  }
}
NODE
}

# 将可发布目标转换为交互式树形多选记录：一级为目录分类，二级为实际发布包。
targets_grouped_options() {
  local records
  local scope
  local label
  local package
  local directory
  local package_name
  local record_scope
  local emitted

  records="$(targets_records)" || return
  for scope in packages plugins; do
    emitted=false
    case "$scope" in
      packages) label='Packages' ;;
      plugins) label='Plugins' ;;
    esac
    while IFS=$'\t' read -r package directory package_name; do
      record_scope="${directory%%/*}"
      [[ "$record_scope" == "$scope" ]] || continue
      if [[ "$emitted" == false ]]; then
        printf 'group:::%s:::%s\n' "$scope" "$label"
        emitted=true
      fi
      printf '%s:::%s:::%s · %s\n' "$scope" "$package" "$package_name" "$directory"
    done <<< "$records"
  done
}

# 返回逻辑包名对应的 workspace 路径。
targets_package_dir() {
  local package="$1"

  targets_records | awk -F '\t' -v package="$package" '$1 == package && !found { print $2; found = 1 }'
}

# 返回逻辑包名对应的 npm 包名。
targets_package_name() {
  local package="$1"

  targets_records | awk -F '\t' -v package="$package" '$1 == package && !found { print $3; found = 1 }'
}

# 判断一个逻辑包名是否可发布。
targets_is_known() {
  local package="$1"

  [[ -n "$(targets_package_dir "$package")" ]]
}

# 判断目标是否定义指定 npm script。
targets_has_script() {
  local package="$1"
  local script="$2"
  local directory

  directory="$(targets_package_dir "$package")" || return
  [[ -n "$directory" ]] || return 1
  node - "$targets_root_dir/$directory/package.json" "$script" <<'NODE'
const { readFileSync } = require('node:fs')
const [file, script] = process.argv.slice(2)
const pkg = JSON.parse(readFileSync(file, 'utf8'))
process.exit(pkg.scripts?.[script] ? 0 : 1)
NODE
}

# 将 all 或逗号分隔的发布目标解析为稳定顺序的逻辑包名。
targets_resolve() {
  local target="$1"
  local selected=()
  local seen=','
  local package
  local record
  local target_package

  if [[ "$target" == 'all' ]]; then
    targets_records | cut -f1
    return
  fi

  [[ -n "$target" ]] || return 2
  IFS=',' read -r -a selected <<< "$target"
  for package in "${selected[@]}"; do
    if ! targets_is_known "$package" || [[ "$seen" == *",${package},"* ]]; then
      return 2
    fi
    seen+="${package},"
  done

  # 以发现顺序输出，保证计划、发布与摘要可复现。
  while IFS=$'\t' read -r target_package _; do
    [[ "$seen" == *",${target_package},"* ]] && printf '%s\n' "$target_package"
  done < <(targets_records)
  return 0
}

# 从 workspace package.json 读取当前版本。
targets_package_version() {
  local root_dir="$1"
  local package="$2"
  local directory

  directory="$(targets_package_dir "$package")" || return
  [[ -n "$directory" ]] || return 2
  node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).version" "$root_dir/$directory/package.json"
}
