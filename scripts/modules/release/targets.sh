#!/usr/bin/env bash

# 发布目标解析。该模块只读取工作区包信息，不渲染终端也不执行外部发布命令。

# 新发布流程支持的稳定发布顺序。
RELEASE_NEXT_PACKAGES=(core vue vant)

# 返回逻辑包名对应的 workspace 路径。
targets_package_dir() {
  # 逻辑包名。
  local package="$1"
  printf 'packages/%s' "$package"
}
# 返回逻辑包名对应的 npm 包名。
targets_package_name() {
  # 逻辑包名。
  local package="$1"
  printf '@schemx/%s' "$package"
}

# 判断一个逻辑包名是否可发布。
targets_is_known() {
  # 待判断的逻辑包名。
  local package="$1"
  # 当前遍历到的受支持包名。
  local candidate
  for candidate in "${RELEASE_NEXT_PACKAGES[@]}"; do
    [[ "$candidate" == "$package" ]] && return 0
  done
  return 1
}

# 将 all 或逗号分隔的发布目标解析为稳定顺序的逻辑包名。
targets_resolve() {
  # 原始发布目标。
  local target="$1"
  # 逗号分隔后得到的用户选择。
  local selected=()
  # 去重后的用户选择标记。
  local seen=','
  # 当前正在检查的包名。
  local package

  if [[ "$target" == 'all' ]]; then
    printf '%s\n' "${RELEASE_NEXT_PACKAGES[@]}"
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

  # 以固定顺序输出，保证计划、发布与摘要可复现。
  for package in "${RELEASE_NEXT_PACKAGES[@]}"; do
    [[ "$seen" == *",${package},"* ]] && printf '%s\n' "$package"
  done
  return 0
}

# 从 workspace package.json 读取当前版本。
targets_package_version() {
  # 仓库根目录。
  local root_dir="$1"
  # 逻辑包名。
  local package="$2"
  # package.json 的绝对路径。
  local package_json="${root_dir}/$(targets_package_dir "$package")/package.json"
  node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).version" "$package_json"
}
