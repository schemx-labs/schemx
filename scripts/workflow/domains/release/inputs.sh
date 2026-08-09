#!/usr/bin/env bash

# 发布输入适配器。负责在 CLI、环境变量和 Gum 交互之间取得一个有效值，不创建发布计划。

# 将换行分隔的选择结果规范为逗号分隔的 CLI 目标参数。
release_join_selection() {
  local value
  local values=()
  local joined=''

  while IFS= read -r value; do
    [[ -n "$value" ]] && values+=("$value")
  done
  for value in "${values[@]}"; do
    [[ -n "$joined" ]] && joined+=','
    joined+="$value"
  done
  printf '%s' "$joined"
}

# 返回发布通道的短说明，供确认后的时间线节点展示。
release_channel_summary() {
  local channel="$1"

  case "$channel" in
    dev) printf 'dev · 开发测试发布' ;;
    alpha) printf 'alpha · 早期实验与分支验证' ;;
    beta) printf 'beta · 面向公开测试' ;;
    rc) printf 'rc · 正式版候选验证' ;;
    next) printf 'next · 下一版本预览' ;;
    latest) printf 'latest · 正式稳定发布 ' ;;
    *) return 2 ;;
  esac
}

# 将逗号分隔的逻辑包名渲染为适合确认节点阅读的 npm 包名列表。
release_target_summary() {
  local target="$1"
  local package
  local summaries=()

  while IFS= read -r package; do
    [[ -n "$package" ]] && summaries+=("$(targets_package_name "$package")")
  done < <(targets_resolve "$target")
  printf '%s' "$(IFS='、'; printf '%s' "${summaries[*]}")"
}

# 返回版本动作或精确版本的短说明，供确认后的时间线节点展示。
release_version_action_summary() {
  local action="$1"

  case "$action" in
    current) printf 'current · 使用当前正式版本' ;;
    patch) printf 'patch · 提升补丁版本' ;;
    minor) printf 'minor · 提升次版本' ;;
    major) printf 'major · 提升主版本' ;;
    *)
      versions_is_stable "$action" && printf '%s · 指定版本基线' "$action"
      ;;
  esac
}

# 选择或验证发布通道。
release_select_channel() {
  local requested="${1:-}"
  local channel

  channel="${requested:-${SCHEMX_RELEASE_CHANNEL:-}}"
  if [[ -z "$channel" ]]; then
    channel="$(ui_prompt select --message '发布通道' \
      --option dev 'dev · 开发测试发布' \
      --option alpha 'alpha · 早期实验与分支验证' \
      --option beta 'beta · 面向公开测试' \
      --option rc 'rc · 正式版候选验证' \
      --option next 'next · 下一版本预览' \
      --option latest 'latest · 正式稳定发布（仅 main）')" || return
  fi
  versions_is_channel "$channel" || {
    ui_status error "未知发布通道：${channel}"
    return 2
  }
  printf '%s' "$channel"
}

# 选择或验证一个或多个发布目标，并统一转换为稳定的逗号分隔参数。
release_select_target() {
  local requested="${1:-}"
  local target
  local resolved
  local package
  local directory
  local package_name
  local selected=()
  local option
  local group_value
  local group_id
  local group_label
  local option_group
  local option_value
  local option_id
  local option_label
  local prompt_arguments=(group-multiselect --message '发布目标（可多选）')

  target="${requested:-${SCHEMX_RELEASE_TARGET:-}}"
  if [[ -z "$target" ]]; then
    while IFS= read -r option; do
      [[ -n "$option" ]] || continue
      if [[ "$option" == group:::* ]]; then
        group_value="${option#group:::}"
        group_id="${group_value%%:::*}"
        group_label="${group_value#*:::}"
        prompt_arguments+=(--group "$group_id" "$group_label")
      else
        option_group="${option%%:::*}"
        option_value="${option#*:::}"
        option_id="${option_value%%:::*}"
        option_label="${option_value#*:::}"
        prompt_arguments+=(--option "$option_group" "$option_id" "$option_label")
      fi
    done < <(targets_grouped_options)
    target="$(ui_prompt "${prompt_arguments[@]}" | release_join_selection)" || return
  fi
  resolved="$(targets_resolve "$target")" || {
    ui_status error "无效发布目标：${target}"
    return 2
  }
  while IFS= read -r package; do
    [[ -n "$package" ]] && selected+=("$package")
  done <<< "$resolved"
  release_join_selection <<< "$(printf '%s\n' "${selected[@]}")"
}

# 选择精确的正式版本基线，并限制为稳定的 x.y.z 格式。
release_select_exact_version() {
  local requested="${1:-}"
  local version

  version="${requested:-${SCHEMX_RELEASE_CUSTOM_VERSION:-}}"
  if [[ -z "$version" ]]; then
    version="$(ui_prompt input --message '输入发布版本基线' --placeholder '例如 1.0.0')" || return
  fi
  versions_is_stable "$version" || {
    ui_status error '版本基线必须是 x.y.z 格式。'
    return 2
  }
  printf '%s' "$version"
}

# 按通道选择或验证版本动作；`custom` 仅是交互别名，最终返回精确版本。
release_select_version_action() {
  local channel="$1"
  local requested="${2:-}"
  local action

  action="${requested:-${SCHEMX_RELEASE_VERSION_ACTION:-}}"
  if [[ -z "$action" ]]; then
    if [[ "$channel" == 'latest' ]]; then
      action="$(ui_prompt select --message '版本动作' \
        --option current 'current · 使用当前正式版本' \
        --option patch 'patch · 提升补丁版本' \
        --option minor 'minor · 提升次版本' \
        --option major 'major · 提升主版本' \
        --option custom 'custom · 指定 x.y.z 版本')" || return
    else
      action="$(ui_prompt select --message '版本基线动作' \
        --option patch 'patch · 下一补丁版本线' \
        --option minor 'minor · 下一次版本线' \
        --option major 'major · 下一主版本线' \
        --option custom 'custom · 指定 x.y.z 版本线')" || return
    fi
  fi
  if [[ "$action" == 'custom' ]]; then
    release_select_exact_version
    return
  fi
  versions_is_action "$action" || {
    ui_status error "无效版本动作：${action}"
    return 2
  }
  if [[ "$channel" != 'latest' && "$action" == 'current' ]]; then
    ui_status error '预发布通道必须选择 patch、minor、major 或精确 x.y.z 版本基线。'
    return 2
  fi
  printf '%s' "$action"
}
