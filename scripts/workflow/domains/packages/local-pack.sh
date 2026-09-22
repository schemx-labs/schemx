#!/usr/bin/env bash

# 本地 tarball 打包领域逻辑。
# 公开函数：packages_pack_local_main。内部函数：packages__pack_*。

set -o pipefail

pack_module_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pack_root="$(cd "$pack_module_root/../.." && pwd)"
pack_directory="$pack_root/.packs"
pack_backup_directory=''
pack_selected_targets=''
pack_tarballs=()
pack_result_directory=''
pack_result_tarballs=()

source "$pack_module_root/ui/api.sh"
source "$pack_module_root/shared/package-json.sh"
source "$pack_module_root/shared/workspace-catalog.sh"

packages__pack_restore_versions() {
  local backup
  local target

  [[ -n "$pack_backup_directory" && -d "$pack_backup_directory" ]] || return
  for backup in "$pack_backup_directory"/*.json; do
    [[ -f "$backup" ]] || continue
    target="$(basename "$backup" .json)"
    cp "$backup" "$pack_root/packages/$target/package.json" || return
  done
  rm -rf "$pack_backup_directory" || return
}

packages__pack_write_version() {
  local target="$1"
  local version="$2"
  local package_file="$pack_root/packages/$target/package.json"
  local temporary_file

  temporary_file="$(mktemp "${TMPDIR:-/tmp}/schemx-pack-package.XXXXXX")" || return
  jq --arg version "$version" '.version = $version' "$package_file" >"$temporary_file" && mv "$temporary_file" "$package_file"
}

packages__pack_requested_targets() {
  local requested="${SCHEMX_WORKFLOW_TARGETS:-all}"
  local scope directory package_name package_file catalog
  local eligible=''
  local selected_count=0
  local identifier
  local matched

  catalog="$(workspace_catalog_discover "$pack_root" packages plugins)" || return
  while IFS=$'\t' read -r scope directory package_name package_file; do
    [[ "$scope" == packages ]] || package_json_has_script "$package_file" pack:local || continue
    eligible+="${scope}/${directory}"$'\t'"${directory}"$'\t'"${package_name}"$'\n'
  done <<< "$catalog"
  if [[ "$requested" == all || -z "$requested" ]]; then
    printf '%s' "$eligible"
    return
  fi
  while IFS= read -r identifier; do
    [[ -n "$identifier" ]] || continue
    matched="$(printf '%s' "$eligible" | awk -F '\t' -v value="$identifier" '$1 == value || $2 == value || $3 == value { print }')"
    if [[ -z "$matched" ]]; then
      ui_status error "存在未知或不可打包的目标：$identifier"
      return 2
    fi
    printf '%s\n' "$matched"
    ((selected_count += 1))
  done < <(tr ',' '\n' <<< "$requested")
  [[ "$selected_count" -gt 0 ]]
}

packages__pack_expand_packages() {
  local selected="$1"
  local target
  local emitted=$'\n'

  # 缺失的内部 workspace 依赖包需先补齐；已经显式选择的目标则保留用户的选择顺序。
  # vue/vant/element-plus 均依赖 @schemx/core，选中任一但未显式选 core 时补齐。
  if [[ "$selected" == *$'\nvue\n'* || "$selected" == *$'\nvant\n'* || "$selected" == *$'\nelement-plus\n'* ]] && [[ "$selected" != *$'\ncore\n'* ]]; then
    printf '%s\n' core
    emitted+="core"$'\n'
  fi
  if [[ "$selected" == *$'\nvant\n'* ]] && [[ "$selected" != *$'\nvue\n'* ]]; then
    printf '%s\n' vue
    emitted+="vue"$'\n'
  fi
  if [[ "$selected" == *$'\nelement-plus\n'* ]] && [[ "$selected" != *$'\nvue\n'* ]]; then
    printf '%s\n' vue
    emitted+="vue"$'\n'
  fi
  while IFS= read -r target; do
    [[ -n "$target" && "$emitted" != *$'\n'"$target"$'\n'* ]] || continue
    printf '%s\n' "$target"
    emitted+="$target"$'\n'
  done <<< "$selected"
}

packages__pack_workspace_package() {
  local target="$1"
  local package_file="$pack_root/packages/$target/package.json"
  local package_name
  local version
  local packed_version
  local result
  local filename

  package_name="$(package_json_name "$package_file")" || return
  if [[ -z "${SCHEMX_PACK_VERSION_PRESET:-}" ]]; then
    version="$(jq -r '.version' "$package_file")" || return
    packed_version="${version}-dev.$(date +%Y%m%d%H%M%S)"
    cp "$package_file" "$pack_backup_directory/$target.json" || return
    packages__pack_write_version "$target" "$packed_version" || return
  fi
  pnpm --filter "$package_name" build || return
  result="$(pnpm --filter "$package_name" pack --pack-destination "$pack_directory" --json)" || return
  filename="$(jq -r 'if type == "array" then .[0].filename else .filename end // empty' <<< "$result")" || return
  [[ -n "$filename" ]] || { ui_status error "$package_name 的 pnpm pack 结果中缺少 filename"; return 1; }
  case "$filename" in
    /*) pack_tarballs+=("$filename") ;;
    *) pack_tarballs+=("$pack_directory/$filename") ;;
  esac
}

packages__pack_plugin() {
  local directory="$1"
  local package_name="$2"
  local output
  local tarball

  output="$(env SCHEMX_WORKFLOW_SILENT=true pnpm --filter "$package_name" run pack:local)" || return
  tarball="$(sed -n 's/^__SCHEMX_LOCAL_TARBALL__=//p' <<< "$output" | tail -n 1)"
  [[ -n "$tarball" ]] || { ui_status error "$package_name 打包完成后未返回本地 tarball 路径"; return 1; }
  pack_tarballs+=("$tarball")
}

packages__pack_local_execute() {
  local records="$1"
  local target_identifier directory package_name
  local install_command='pnpm i'

  package_json_require_jq || return
  [[ -n "$records" ]] || return
  mkdir -p "$pack_directory" || return
  if [[ -z "${SCHEMX_PACK_VERSION_PRESET:-}" ]]; then
    pack_backup_directory="$(mktemp -d "${TMPDIR:-/tmp}/schemx-pack-backup.XXXXXX")" || return
    trap 'packages__pack_restore_versions; ui_flow_cleanup' EXIT INT TERM
  fi

  while IFS=$'\t' read -r target_identifier directory package_name; do
    [[ -n "$directory" ]] || continue
    if [[ "${target_identifier%%/*}" == packages ]]; then
      packages__pack_workspace_package "$directory" || return
    else
      packages__pack_plugin "$directory" "$package_name" || return
    fi
  done <<< "$records"

  for target in "${pack_tarballs[@]}"; do
    install_command+=" $(printf '%q' "$target")"
  done
  if [[ -n "${SCHEMX_PACK_RESULT_FILE:-}" ]]; then
    printf 'directory\t%s\n' "$pack_directory" >> "$SCHEMX_PACK_RESULT_FILE" || return
    for target in "${pack_tarballs[@]}"; do
      printf 'tarball\t%s\n' "$target" >> "$SCHEMX_PACK_RESULT_FILE" || return
    done
  else
    ui_note "产物目录：$pack_directory"
    ui_note "安装命令：$install_command"
  fi
}

packages__pack_run_leaf() {
  local title="$1"
  shift
  local result_file
  local result_kind result_value
  local leaf_directory=''
  local leaf_install_command='pnpm i'
  local leaf_tarballs=()

  result_file="$(mktemp "${TMPDIR:-/tmp}/schemx-pack-result.XXXXXX")" || return
  if ui_task --title "$title" --log live -- env "SCHEMX_PACK_RESULT_FILE=$result_file" "$@"; then
    while IFS=$'\t' read -r result_kind result_value; do
      case "$result_kind" in
        directory)
          pack_result_directory="$result_value"
          leaf_directory="$result_value"
          ;;
        tarball)
          pack_result_tarballs+=("$result_value")
          leaf_tarballs+=("$result_value")
          ;;
      esac
    done < "$result_file"
    rm -f "$result_file" || return
    [[ -z "$leaf_directory" ]] || ui_note "产物目录：$leaf_directory" || return
    for result_value in "${leaf_tarballs[@]}"; do
      leaf_install_command+=" $(printf '%q' "$result_value")"
    done
    [[ "${#leaf_tarballs[@]}" -eq 0 ]] || ui_note "安装命令：$leaf_install_command" || return
  else
    local exit_code=$?
    rm -f "$result_file" || return
    return "$exit_code"
  fi
}

# 协调多个目标时只在这里展开包依赖；叶子执行器始终只打包一个目标，
# 以保证任务展示和事件记录与实际包一一对应。
packages__pack_local_orchestrate() {
  local records
  local package_dirs=$'\n'
  local target_identifier directory package_name
  local target
  local install_command='pnpm i'
  local expanded
  local shared_timestamp
  local base_version

  pack_result_directory=''
  pack_result_tarballs=()

  records="$(packages__pack_requested_targets)" || return
  [[ -n "$records" ]] || return
  while IFS=$'\t' read -r target_identifier directory package_name; do
    [[ -n "$directory" ]] || continue
    if [[ "${target_identifier%%/*}" == packages ]]; then
      package_dirs+="$directory"$'\n'
    else
      packages__pack_run_leaf "打包 ${package_name}" env SCHEMX_WORKFLOW_SILENT=true pnpm --dir "$target_identifier" run pack:local || return
    fi
  done <<< "$records"

  expanded="$(packages__pack_expand_packages "$package_dirs")"
  if [[ -n "$expanded" ]]; then
    # 闭包内所有 workspace 包统一使用同一 dev 时间戳版本，确保 pack 时 workspace:*
    # 内部依赖引用解析到一致的 dev 版本，而不是被还原后的 base 版本。
    package_json_require_jq || return
    mkdir -p "$pack_directory" || return
    pack_backup_directory="$(mktemp -d "${TMPDIR:-/tmp}/schemx-pack-backup.XXXXXX")" || return
    trap 'packages__pack_restore_versions; ui_flow_cleanup' EXIT INT TERM
    shared_timestamp="$(date +%Y%m%d%H%M%S)"
    while IFS= read -r target; do
      [[ -n "$target" ]] || continue
      base_version="$(jq -r '.version' "$pack_root/packages/$target/package.json")" || return
      cp "$pack_root/packages/$target/package.json" "$pack_backup_directory/$target.json" || return
      packages__pack_write_version "$target" "${base_version}-dev.${shared_timestamp}" || return
    done <<< "$expanded"

    # 版本已统一预置；叶子只负责 build + pack，不再各自 bump/restore。
    export SCHEMX_PACK_VERSION_PRESET=1
    while IFS= read -r target; do
      [[ -n "$target" ]] || continue
      packages__pack_run_leaf "打包 packages/${target}" pnpm --dir "packages/$target" run pack-local || return
    done <<< "$expanded"
    unset SCHEMX_PACK_VERSION_PRESET

    packages__pack_restore_versions || return
    trap - EXIT INT TERM
  fi

  for target in "${pack_result_tarballs[@]}"; do
    install_command+=" $(printf '%q' "$target")"
  done
  [[ "${#pack_result_tarballs[@]}" -eq 0 ]] || ui_copyable_summary --title '全部 tarball 安装命令' --tone success --content "已生成 ${#pack_result_tarballs[@]} 个 tarball。" --copy "$install_command"
}

packages_pack_local_main() {
  local exit_code

  case "${1:-}" in
    --target)
      [[ $# -eq 2 ]] || { ui_status error 'pack-local --target 需要一个目标。'; return 2; }
      SCHEMX_WORKFLOW_TARGETS="$2" packages__pack_local_execute "$(SCHEMX_WORKFLOW_TARGETS="$2" packages__pack_requested_targets)"
      exit_code=$?
      if [[ -z "${SCHEMX_PACK_VERSION_PRESET:-}" ]]; then
        packages__pack_restore_versions || return
        trap - EXIT INT TERM
      fi
      return "$exit_code"
      ;;
    '') packages__pack_local_orchestrate ;;
    *) ui_status error "未知 pack-local 参数：$1"; return 2 ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  packages_pack_local_main "$@"
fi
