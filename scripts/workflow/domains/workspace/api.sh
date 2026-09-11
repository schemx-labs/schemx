#!/usr/bin/env bash

# workspace 目标公共 API。
# 公开函数：workspace_discover_task_targets、workspace_discover_targets、workspace_parse_batch_arguments、
# workspace_select_target_identifiers、workspace_select_task_targets、workspace_task_label。
# 内部函数：workspace__*（仅本文件使用）。

workspace_module_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$workspace_module_dir/../../shared/package-json.sh"
source "$workspace_module_dir/../../shared/workspace-catalog.sh"

# 按任务发现可执行目标，输出 scope、目录名、npm 包名和实际 script 名四列。
workspace_discover_task_targets() {
  local root_dir="$1"
  local task="$2"

  local candidates=()
  local scope directory package_name package_file
  local candidate
  local selected_script

  case "$task" in
    build) candidates=(build build:h5) ;;
    dev) candidates=(dev dev:h5) ;;
    code-check) candidates=(check) ;;
    *) candidates=("$task") ;;
  esac

  while IFS=$'\t' read -r scope directory package_name package_file; do
    selected_script=''
    for candidate in "${candidates[@]}"; do
      if package_json_has_script "$package_file" "$candidate"; then
        selected_script="$candidate"
        break
      fi
    done
    [[ -n "$selected_script" ]] || continue
    printf '%s\t%s\t%s\t%s\n' "$scope" "$directory" "$package_name" "$selected_script"
  done < <(workspace_catalog_discover "$root_dir" packages plugins examples)
}

# 将一行一个目标标识转换为逗号分隔列表，供 WORKFLOW_TARGETS 和 CLI 统一消费。
workspace__join_targets() {
  local value
  local result=''

  while IFS= read -r value; do
    [[ -n "$value" ]] || continue
    [[ -n "$result" ]] && result+=','
    result+="$value"
  done
  printf '%s' "$result"
}

# 解析 workspace 有限任务共用的可选 target 和 --keep-going。
# 参数：flag 可出现在 target 前后；最多允许一个 target。
# 返回：成功时写入 WORKSPACE_BATCH_TARGET、WORKSPACE_BATCH_KEEP_GOING 和 WORKSPACE_BATCH_HELP。
workspace_parse_batch_arguments() {
  WORKSPACE_BATCH_TARGET=''
  WORKSPACE_BATCH_KEEP_GOING=false
  WORKSPACE_BATCH_HELP=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --keep-going) WORKSPACE_BATCH_KEEP_GOING=true ;;
      -h | --help | help) WORKSPACE_BATCH_HELP=true ;;
      -*) ui_status error "未知 workspace 选项：$1"; return 2 ;;
      *)
        [[ -z "$WORKSPACE_BATCH_TARGET" ]] || { ui_status error 'workspace 有限任务最多接受一个 target。'; return 2; }
        WORKSPACE_BATCH_TARGET="$1"
        ;;
    esac
    shift
  done
}

# 按 scope:script 规则发现目标；`*` 表示该 scope 中的全部 package.json 目标。
# 输出格式与任务发现保持一致，便于由同一选择器消费。
workspace_discover_targets() {
  local root_dir="$1"
  local rules="$2"

  local rule
  local separator
  local scope
  local script
  local directory
  local package_name
  local package_file
  local output_script

  while IFS= read -r rule; do
    [[ -n "$rule" ]] || continue
    separator="${rule%%:*}"
    if [[ "$rule" == *:* ]]; then
      scope="$separator"
      script="${rule#*:}"
    else
      scope="$rule"
      script='*'
    fi
    output_script=''
    [[ "$script" != '*' ]] && output_script="$script"
    while IFS=$'\t' read -r _ directory package_name package_file; do
      if [[ "$script" != '*' ]] && ! package_json_has_script "$package_file" "$script"; then
        continue
      fi
      printf '%s\t%s\t%s\t%s\n' "$scope" "$directory" "$package_name" "$output_script"
    done < <(workspace_catalog_discover "$root_dir" "$scope")
  done < <(tr ',' '\n' <<< "$rules")
}

# 返回目录分类在树形交互控件中使用的名称，保持目录层级的可辨识性。
workspace__scope_prompt_label() {
  local scope="$1"

  case "$scope" in
    packages) printf 'Packages' ;;
    plugins) printf 'Plugins' ;;
    examples) printf 'Examples' ;;
    *) printf '%s' "$scope" ;;
  esac
}

# 返回记录中出现的 scope，按项目层级的稳定顺序输出。
workspace__record_scopes() {
  local records="$1"
  local scope
  local known_scope

  for known_scope in packages plugins examples; do
    while IFS=$'\t' read -r scope _; do
      if [[ "$scope" == "$known_scope" ]]; then
        printf '%s\n' "$known_scope"
        break
      fi
    done <<< "$records"
  done
}

# 将工作区记录转换为树形多选项：一级节点是目录分类，二级节点是实际目录名称。
workspace__grouped_target_options() {
  local records="$1"
  local scope
  local scope_label
  local directory
  local package_name
  local script
  local record_scope

  while IFS= read -r scope; do
    [[ -n "$scope" ]] || continue
    scope_label="$(workspace__scope_prompt_label "$scope")"
    printf 'group:::%s:::%s\n' "$scope" "$scope_label"
    while IFS=$'\t' read -r record_scope directory package_name script; do
      [[ "$record_scope" == "$scope" ]] || continue
      printf '%s:::%s/%s:::%s\n' "$scope" "$scope" "$directory" "$directory"
    done <<< "$records"
  done < <(workspace__record_scopes "$records")
}

# 从已发现的目标记录中选择目标。默认使用树形多选；`single` 模式使用平铺单选。
workspace_select_target_identifiers() {
  local title="$1"
  local records="$2"
  local requested="${3:-}"
  local mode="${4:-multi}"
  local grouped_options
  local option
  local identifier
  local grouped_option_lines=()
  local prompt_args=()
  local selected

  case "$mode" in
    multi) prompt_args=(group-multiselect --message "$title") ;;
    single) prompt_args=(select --message "$title") ;;
    *) ui_status error "未知目标选择模式：${mode}"; return 2 ;;
  esac

  selected="${requested:-${SCHEMX_WORKFLOW_TARGETS:-${SCHEMX_WORKFLOW_TARGET:-}}}"
  if [[ -n "$selected" ]]; then
    if [[ "$mode" == single && "$selected" == *,* ]]; then
      ui_status error '当前流程仅支持选择一个目标。'
      return 2
    fi
    printf '%s' "$selected"
    return
  fi
  if ! ui_is_interactive; then
    printf 'all'
    return
  fi

  if [[ "$mode" == single ]]; then
    while IFS=$'\t' read -r scope directory package_name _; do
      [[ -n "$package_name" ]] || continue
      identifier="${scope}/${directory}"
      prompt_args+=(--option "$identifier" "$identifier")
    done <<< "$records"
  else
    grouped_options="$(workspace__grouped_target_options "$records")"
    [[ -n "$grouped_options" ]] || return
    while IFS= read -r option; do
      [[ -n "$option" ]] && grouped_option_lines+=("$option")
    done <<< "$grouped_options"
    while IFS= read -r option; do
      [[ -n "$option" ]] || continue
      if [[ "$option" == group:::* ]]; then
        local group_value="${option#group:::}"
        local group_id="${group_value%%:::*}"
        local group_label="${group_value#*:::}"
        prompt_args+=(--group "$group_id" "$group_label")
      else
        local option_group="${option%%:::*}"
        local option_value="${option#*:::}"
        local option_id="${option_value%%:::*}"
        local option_label="${option_value#*:::}"
        prompt_args+=(--option "$option_group" "$option_id" "$option_label")
      fi
    done <<< "$grouped_options"
  fi
  selected="$(ui_prompt "${prompt_args[@]}")" || return
  if [[ -z "$selected" ]]; then
    ui_status error '请至少选择一个目标后再继续。'
    return 2
  fi
  if [[ "$mode" == single ]]; then
    printf '%s' "$selected"
    return
  fi
  # Clack 多选以一行一个值返回；统一转换为 CLI 与环境变量同样使用的逗号列表。
  workspace__join_targets <<< "$selected"
}

# 返回任务的中文显示名。
workspace_task_label() {
  local task="$1"

  case "$task" in
    dev) printf '启动开发服务' ;;
    build) printf '构建' ;;
    build:analyze) printf '构建分析' ;;
    check) printf '完整检查' ;;
    code-check) printf '代码检查' ;;
    lint) printf '检查 lint' ;;
    lint:fix) printf '修复 lint' ;;
    format) printf '格式化' ;;
    format:check) printf '检查格式' ;;
    type-check) printf '类型检查' ;;
    test) printf '测试' ;;
    *) printf '执行 %s' "$task" ;;
  esac
}

# 选择任务目标；非交互环境默认全部，交互环境默认使用 Clack 树形多选。
workspace_select_task_targets() {
  local root_dir="$1"
  local task="$2"
  local requested="${3:-}"
  local selection_mode="${4:-multi}"
  local records
  local scope directory package_name script
  local selected
  local selected_marker=','

  case "$selection_mode" in
    multi | single) ;;
    *) ui_status error "未知目标选择模式：${selection_mode}"; return 2 ;;
  esac

  records="$(workspace_discover_task_targets "$root_dir" "$task")"
  [[ -n "$records" ]] || return 0
  selected="${requested:-${SCHEMX_WORKFLOW_TARGETS:-}}"
  if [[ -z "$selected" && -n "${SCHEMX_WORKFLOW_TARGET:-}" ]]; then
    selected="$SCHEMX_WORKFLOW_TARGET"
  fi
  if [[ "$selection_mode" == single && "$selected" == *,* ]]; then
    ui_status error '当前流程仅支持选择一个目标。'
    return 2
  fi
  if [[ -z "$selected" ]] && ui_is_interactive; then
    selected="$(workspace_select_target_identifiers "请选择 $(workspace_task_label "$task") 的目标" "$records" '' "$selection_mode")" || return
  fi
  if [[ -z "$selected" || "$selected" == 'all' ]]; then
    printf '%s\n' "$records"
    return
  fi
  selected_marker+=",${selected//,/,,},"
  while IFS=$'\t' read -r scope directory package_name script; do
    if [[ "$selected_marker" == *",${scope}/${directory},"* || "$selected_marker" == *",${directory},"* || "$selected_marker" == *",${package_name},"* ]]; then
      printf '%s\t%s\t%s\t%s\n' "$scope" "$directory" "$package_name" "$script"
    fi
  done <<< "$records"
}
