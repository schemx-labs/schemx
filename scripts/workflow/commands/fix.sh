#!/usr/bin/env bash

# 统一代码修复命令：默认执行 workspace 的格式化与 lint 自动修复；提交钩子使用 --staged。
# 参数：默认接受 workspace target 与 --keep-going；--staged 只处理当前已暂存的文件。
# 副作用：默认模式会修改选中 workspace 的代码；--staged 会重新暂存已修复的文件。
# 退出码：任一修复命令失败时返回其退出码；没有可修复文件时返回 0。

set -euo pipefail

fix_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$fix_root"

fix_usage() {
  cat <<'USAGE'
用法：
  bash scripts/workflow.sh fix [target] [--keep-going]
  bash scripts/workflow.sh fix --staged

默认模式执行 format 与 lint:fix；--staged 只修复当前暂存文件并重新暂存修复结果。
USAGE
}

fix_staged() {
  local staged_file
  local -a staged_files=()
  local -a format_files=()
  local -a lint_files=()

  while IFS= read -r -d '' staged_file; do
    [[ -n "$staged_file" ]] || continue
    staged_files+=("$staged_file")
    [[ -f "$staged_file" ]] || continue
    case "$staged_file" in
      *.ts | *.tsx | *.vue | *.js | *.jsx | *.mjs | *.cjs)
        format_files+=("$staged_file")
        lint_files+=("$staged_file")
        ;;
      *.json | *.css | *.scss)
        format_files+=("$staged_file")
        ;;
    esac
  done < <(git diff --cached --name-only --diff-filter=ACMR -z)

  if [[ "${#staged_files[@]}" -eq 0 ]]; then
    printf '%s\n' '没有已暂存文件，跳过代码修复。'
    return 0
  fi

  if [[ "${#lint_files[@]}" -gt 0 ]]; then
    pnpm exec eslint --fix "${lint_files[@]}"
  fi
  if [[ "${#format_files[@]}" -gt 0 ]]; then
    pnpm exec prettier --write "${format_files[@]}"
  fi

  git add -- "${staged_files[@]}"
}

# Arguments: workspace target and --keep-going, forwarded to format and lint:fix.
# Side effects: modifies the selected workspace files.
fix_workspace() {
  local -a workflow_args=("$@")

  bash "$fix_root/scripts/workflow.sh" lint:fix "${workflow_args[@]}"
  bash "$fix_root/scripts/workflow.sh" format "${workflow_args[@]}"
}

case "${1:-}" in
  --staged)
    [[ "$#" -eq 1 ]] || { fix_usage; exit 2; }
    fix_staged
    ;;
  -h | --help | help)
    fix_usage
    ;;
  *)
    fix_workspace "$@"
    ;;
esac
