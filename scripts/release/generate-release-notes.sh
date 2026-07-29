#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/release/common.sh"

if [[ "$#" -eq 0 ]]; then
  die "缺少用于生成 Release notes 的包名。"
fi

if [[ "$#" -ne 1 ]]; then
  die "Release notes 需要按单个包生成。"
fi

pkg="$1"
version="$(package_json_value "$pkg" version)"
tag_name="$(release_tag_name "$pkg")"
title="$(release_title "$pkg")"
previous_tag=""

# 默认从当前包根目录读取静态发布说明；仍允许环境变量显式覆盖，兼容临时发布场景。
release_notes_file="${SCHEMX_RELEASE_NOTES_FILE:-$(package_path "$pkg")/release-notes.md}"
# 允许外部 Agent 或 LLM CLI 按发布上下文生成 Markdown 摘要。
release_notes_generator="${SCHEMX_RELEASE_NOTES_GENERATOR:-}"

# 从当前分支可见 tag 中找到同包的最近一次发布，确定提交范围。
while IFS= read -r candidate_tag; do
  if [[ "$candidate_tag" != "$tag_name" && "$candidate_tag" == "@schemx/$pkg@"* ]]; then
    previous_tag="$candidate_tag"
    break
  fi
done < <(git tag --sort=-creatordate --merged HEAD)

if [[ -n "$previous_tag" ]]; then
  commit_range="${previous_tag}..HEAD"
else
  commit_range="HEAD"
fi

cat <<NOTES
## ${title}

- \`@schemx/${pkg}@${version}\`
NOTES

cat <<'NOTES'

### 变更摘要
NOTES

if [[ -n "$previous_tag" ]]; then
  printf '\n对比范围：`%s...%s`\n' "$previous_tag" "$tag_name"
else
  printf '\n这是当前仓库可追踪到的首个 release tag。\n'
fi

# 包级静态文件优先于外部生成器，便于发布人最终确认和固定发布说明。
if [[ -f "$release_notes_file" ]]; then
  if [[ ! -r "$release_notes_file" ]]; then
    die "Release notes 文件不可读：$release_notes_file"
  fi

  cat <<'NOTES'

### 发布说明
NOTES
  printf '\n'
  cat "$release_notes_file"
  exit 0
fi

if [[ -n "${SCHEMX_RELEASE_NOTES_FILE:-}" ]]; then
  die "指定的 Release notes 文件不存在：$release_notes_file"
fi

# 生成器只接收结构化上下文，不拼接或 eval 用户输入，避免脚本注入。
if [[ -n "$release_notes_generator" ]]; then
  if [[ ! -x "$release_notes_generator" ]]; then
    die "Release notes 生成器不可执行：$release_notes_generator"
  fi

  generated_notes="$(
    "$release_notes_generator" \
      --repository "$ROOT_DIR" \
      --package "$pkg" \
      --version "$version" \
      --tag "$tag_name" \
      --previous-tag "$previous_tag" \
      --commit-range "$commit_range"
  )" || die "Release notes 生成器执行失败：$release_notes_generator"

  if [[ -z "${generated_notes//[[:space:]]/}" ]]; then
    die "Release notes 生成器未返回内容：$release_notes_generator"
  fi

  cat <<'NOTES'

### 发布说明
NOTES
  printf '\n%s\n' "$generated_notes"
  exit 0
fi

commit_subjects=()
while IFS= read -r subject; do
  commit_subjects+=("$subject")
done < <(git log --no-merges --format=%s "$commit_range")

if [[ "${#commit_subjects[@]}" -eq 0 ]]; then
  cat <<'NOTES'

- 本次发布没有检测到新的 Git commit。
NOTES
  exit 0
fi

# 按 Conventional Commit 前缀输出一个非空的 Release notes 分组。
print_section() {
  local title="$1"
  local pattern="$2"
  local matched=0
  local subject

  for subject in "${commit_subjects[@]}"; do
    if [[ "$subject" =~ $pattern ]]; then
      if [[ "$matched" -eq 0 ]]; then
        printf '\n### %s\n\n' "$title"
      fi
      printf -- '- %s\n' "$subject"
      matched=1
    fi
  done
}

# 固定分类顺序，保证 GitHub Release 的阅读结构稳定。
print_section "Features" '^feat(\(|:|!)'
print_section "Fixes" '^fix(\(|:|!)'
print_section "Performance" '^perf(\(|:|!)'
print_section "Refactors" '^refactor(\(|:|!)'
print_section "Documentation" '^docs(\(|:|!)'
print_section "Tooling" '^(chore|build|ci|test)(\(|:|!)'

# 未被已知 Conventional Commit 类型覆盖的提交统一归入 Other。
other_subjects=()
for subject in "${commit_subjects[@]}"; do
  if [[ ! "$subject" =~ ^(feat|fix|perf|refactor|docs|chore|build|ci|test)(\(|:|!) ]]; then
    other_subjects+=("$subject")
  fi
done

if [[ "${#other_subjects[@]}" -gt 0 ]]; then
  printf '\n### Other\n\n'
  for subject in "${other_subjects[@]}"; do
    printf -- '- %s\n' "$subject"
  done
fi
