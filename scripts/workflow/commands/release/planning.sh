#!/usr/bin/env bash

# 发布计划编排。公开函数：release_create_plan。

# 创建冻结计划；预发布序号在写入计划前从 npm registry 查询并固定下来。
release_create_plan() {
  # 发布通道。
  local channel="$1"
  # 原始发布目标。
  local target="$2"
  # 版本动作或精确版本。
  local version_action="$3"
  # 输出计划文件。
  local plan_file="$4"
  # 已解析的目标包。
  local packages=()
  # 换行分隔的目标解析结果。
  local resolved_targets
  # 当前遍历到的目标包。
  local package
  # 当前目标的 npm 包名。
  local package_name
  # 当前 package.json 版本。
  local current_version
  # 计算得到的正式版本基线。
  local baseline_version
  # 实际发布版本。
  local release_version
  # 当前包对应的 npm 预发布序号。
  local sequence
  # 当前源码短 SHA。
  local source_sha
  # 传入计划序列化器的包记录。
  local records=()

  versions_is_channel "$channel" || {
    ui_status error "未知发布通道：${channel}"
    return 2
  }
  versions_is_action "$version_action" || {
    ui_status error "无效版本动作：${version_action}"
    return 2
  }
  if [[ "$channel" != 'latest' && "$version_action" == 'current' ]]; then
    ui_status error '预发布通道必须选择 patch、minor、major 或精确 x.y.z 版本基线。'
    return 2
  fi

  if ! resolved_targets="$(targets_resolve "$target")"; then
    ui_status error "无效发布目标：${target}"
    return 2
  fi
  while IFS= read -r package; do
    [[ -n "$package" ]] && packages+=("$package")
  done <<< "$resolved_targets"
  if versions_is_stable "$version_action" && [[ "${#packages[@]}" -ne 1 ]]; then
    ui_status error '精确版本仅允许单包目标。'
    return 2
  fi

  source_sha="${SCHEMX_RELEASE_SHA:-$(git rev-parse --short HEAD 2>/dev/null || printf 'local')}"
  for package in "${packages[@]}"; do
    package_name="$(targets_package_name "$package")" || return
    [[ -n "$package_name" ]] || return 2
    current_version="$(targets_package_version "$workflow_root" "$package")"
    baseline_version="$(versions_baseline "$current_version" "$version_action")" || {
      ui_status error "无法根据 ${current_version} 计算 ${version_action} 版本基线。"
      return 2
    }
    if [[ "$channel" == 'alpha' || "$channel" == 'beta' || "$channel" == 'rc' || "$channel" == 'next' ]]; then
      if [[ -n "${SCHEMX_RELEASE_PRERELEASE_SEQUENCE:-}" ]]; then
        sequence="$SCHEMX_RELEASE_PRERELEASE_SEQUENCE"
        [[ "$sequence" =~ ^[0-9]+$ ]] || {
          ui_status error 'SCHEMX_RELEASE_PRERELEASE_SEQUENCE 必须是非负整数。'
          return 2
        }
      else
        sequence="$(preflight_next_prerelease_sequence "$package_name" "$baseline_version" "$channel")" || {
          ui_status error "无法从 npm registry 查询 ${package_name} 的 ${channel} 预发布序号。"
          return 1
        }
      fi
    else
      sequence=0
    fi
    release_version="$(versions_release_version "$channel" "$baseline_version" "$sequence")" || return 2
    records+=("${package}|${package_name}|${current_version}|${baseline_version}|${release_version}")
  done

  plan_write "$plan_file" "$channel" "$target" "$version_action" "$(versions_dist_tag "$channel")" "$source_sha" "${records[@]}"
}
