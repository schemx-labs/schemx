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

print_section "Features" '^feat(\(|:|!)'
print_section "Fixes" '^fix(\(|:|!)'
print_section "Performance" '^perf(\(|:|!)'
print_section "Refactors" '^refactor(\(|:|!)'
print_section "Documentation" '^docs(\(|:|!)'
print_section "Tooling" '^(chore|build|ci|test)(\(|:|!)'

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
