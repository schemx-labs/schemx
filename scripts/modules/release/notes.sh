#!/usr/bin/env bash

# GitHub Release notes 生成器。只读取 Git 与包级说明文件，并将 Markdown 写入调用方指定文件。

notes_root="$(cd "$(dirname "$BASH_SOURCE")/../.." && pwd)"
if ! declare -F ui_status >/dev/null 2>&1; then
  source "$notes_root/lib/ui.sh"
fi

# 返回一个包在指定提交上对应的发布 Tag 名称。
notes_tag_name() {
  local package_name="$1"
  local version="$2"

  printf '%s@%s' "$package_name" "$version"
}

# 找到当前提交可见的、同一 npm 包最近一次发布 Tag。
notes_previous_tag() {
  local package_name="$1"
  local current_tag="$2"
  local target_ref="$3"
  local candidate_tag

  while IFS= read -r candidate_tag; do
    if [[ "$candidate_tag" != "$current_tag" && "$candidate_tag" == "${package_name}@"* ]]; then
      printf '%s' "$candidate_tag"
      return 0
    fi
  done < <(git tag --sort=-creatordate --merged "$target_ref")
  return 0
}

# 将提交主题按固定分类写入 Markdown；未分类主题归入 Other。
notes_write_commit_summary() {
  local commit_range="$1"
  local output_file="$2"
  local subject
  local subjects=()
  local unmatched=()
  local title pattern

  while IFS= read -r subject; do
    [[ -n "$subject" ]] && subjects+=("$subject")
  done < <(git log --no-merges --format=%s "$commit_range")
  if [[ "${#subjects[@]}" -eq 0 ]]; then
    printf '\n- 本次发布没有检测到新的 Git commit。\n' >>"$output_file"
    return
  fi

  for title in Features Fixes Performance Refactors Documentation Tooling; do
    case "$title" in
      Features) pattern='^feat(\(|:|!)' ;;
      Fixes) pattern='^fix(\(|:|!)' ;;
      Performance) pattern='^perf(\(|:|!)' ;;
      Refactors) pattern='^refactor(\(|:|!)' ;;
      Documentation) pattern='^docs(\(|:|!)' ;;
      Tooling) pattern='^(chore|build|ci|test)(\(|:|!)' ;;
    esac
    local written=false
    for subject in "${subjects[@]}"; do
      if [[ "$subject" =~ $pattern ]]; then
        if [[ "$written" == false ]]; then
          printf '\n### %s\n\n' "$title" >>"$output_file"
          written=true
        fi
        printf -- '- %s\n' "$subject" >>"$output_file"
      fi
    done
  done

  for subject in "${subjects[@]}"; do
    if [[ ! "$subject" =~ ^(feat|fix|perf|refactor|docs|chore|build|ci|test)(\(|:|!) ]]; then
      unmatched+=("$subject")
    fi
  done
  if [[ "${#unmatched[@]}" -gt 0 ]]; then
    printf '\n### Other\n\n' >>"$output_file"
    for subject in "${unmatched[@]}"; do
      printf -- '- %s\n' "$subject" >>"$output_file"
    done
  fi
}

# 为一个冻结计划中的包写入完整 Release notes。
notes_write_release_notes() {
  local root_dir="$1"
  local package="$2"
  local package_name="$3"
  local version="$4"
  local tag_name="$5"
  local target_ref="$6"
  local output_file="$7"
  local notes_file="${SCHEMX_RELEASE_NOTES_FILE:-$root_dir/packages/$package/release-notes.md}"
  local generator="${SCHEMX_RELEASE_NOTES_GENERATOR:-}"
  local previous_tag
  local commit_range
  local generated_notes

  previous_tag="$(notes_previous_tag "$package_name" "$tag_name" "$target_ref")"
  if [[ -n "$previous_tag" ]]; then
    commit_range="${previous_tag}..${target_ref}"
  else
    commit_range="$target_ref"
  fi
  printf '## %s\n\n- `%s@%s`\n\n### 变更摘要\n' "$tag_name" "$package_name" "$version" >"$output_file"
  if [[ -n "$previous_tag" ]]; then
    printf '\n对比范围：`%s...%s`\n' "$previous_tag" "$tag_name" >>"$output_file"
  else
    printf '\n这是当前仓库可追踪到的首个 release tag。\n' >>"$output_file"
  fi
  if [[ -f "$notes_file" ]]; then
    [[ -r "$notes_file" ]] || { ui_status error "Release notes 文件不可读：$notes_file"; return 1; }
    printf '\n### 发布说明\n\n' >>"$output_file"
    cat "$notes_file" >>"$output_file"
    return
  fi
  if [[ -n "${SCHEMX_RELEASE_NOTES_FILE:-}" ]]; then
    ui_status error "指定的 Release notes 文件不存在：$notes_file"
    return 1
  fi
  if [[ -n "$generator" ]]; then
    [[ -x "$generator" ]] || { ui_status error "Release notes 生成器不可执行：$generator"; return 1; }
    generated_notes="$("$generator" --repository "$root_dir" --package "$package" --version "$version" --tag "$tag_name" --previous-tag "$previous_tag" --commit-range "$commit_range")" || return
    [[ -n "${generated_notes//[[:space:]]/}" ]] || { ui_status error "Release notes 生成器未返回内容：$generator"; return 1; }
    printf '\n### 发布说明\n\n%s\n' "$generated_notes" >>"$output_file"
    return
  fi
  notes_write_commit_summary "$commit_range" "$output_file"
}
