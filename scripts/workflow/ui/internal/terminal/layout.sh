#!/usr/bin/env bash

# UI 内部布局原语；业务命令不得直接调用。

set -o pipefail

# 按指定 group 深度渲染单行 UI 反馈，自动选择 pretty 或 plain 输出。
# 参数：$1 为缩进深度，$2 为行类型，$3 为颜色令牌，$4 为展示文本。
# 返回：渲染成功时返回 0，否则返回底层 Gum 或输出错误码。
ui__render_line_at_depth() {
  local depth="$1"
  local kind="$2"
  local color="$3"
  local message="$4"
  local indent=''
  local marker
  local content

  printf -v indent '%*s' "$((depth * 2))" ''
  if ui__can_style; then
    marker="$(ui__symbol "$kind" "$color")" || return
    content="$(ui__text "$color" bold "$message")" || return
    printf '%s' "$indent" >&2
    gum join -- "$(gum style --width 2 --align left -- "$marker")" ' ' "$content" >&2
  else
    case "$kind" in
      note) printf '%s[说明] %s\n' "$indent" "$message" >&2 ;;
      task) printf '%s[任务] %s\n' "$indent" "$message" >&2 ;;
      success) printf '%s[成功] %s\n' "$indent" "$message" >&2 ;;
      warning) printf '%s[警告] %s\n' "$indent" "$message" >&2 ;;
      error) printf '%s[错误] %s\n' "$indent" "$message" >&2 ;;
      group) printf '%s--- %s ---\n' "$indent" "$message" >&2 ;;
      *) printf '%s%s\n' "$indent" "$message" >&2 ;;
    esac
  fi
}

# 按当前 group 内容深度渲染单行 UI 反馈。
# 参数：$1 为行类型，$2 为颜色令牌，$3 为展示文本。
# 返回：渲染成功时返回 0，否则返回底层 Gum 或输出错误码。
ui__render_line() {
  local depth
  depth="$(ui__group_depth)" || return
  ui__render_line_at_depth "$depth" "$1" "$2" "$3"
}

# 为 plain 模式的多行内容逐行添加 group 缩进。
# 参数：$1 为缩进深度，$2 为多行内容。
# 返回：所有行写入 stderr 时返回 0，否则返回 printf 错误码。
ui__render_plain_block() {
  local depth="$1"
  local content="$2"
  local indent=''
  local line

  printf -v indent '%*s' "$((depth * 2))" ''
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '%s%s\n' "$indent" "$line" >&2 || return
  done <<< "$content"
}

# 将多行原生命令输出逐行渲染为统一的日志块。
# 参数：$1 为行类型，$2 为颜色令牌，$3 为多行内容。
# 返回：所有行渲染成功时返回 0，否则返回首个错误码。
ui__render_block() {
  local kind="$1"
  local color="$2"
  local content="$3"
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    ui__render_line "$kind" "$color" "$line" || return
  done <<< "$content"
}

# 渲染带圆角边框的多行卡片；plain 模式下退化为原文输出。
# 参数：$1 为边框颜色令牌，$2 为卡片内容。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_card() {
  local border="$1"
  local content="$2"
  local depth
  depth="$(ui__group_depth)" || return
  if ui__can_style; then
    local color="$(ui__color "$border")" || return
    gum style --border rounded --border-foreground "$color" --padding '1 2' --margin "0 0 0 $((depth * 2))" --width 72 -- "$content" >&2
  else
    ui__render_plain_block "$depth" "$content"
  fi
}

# 渲染任务实际执行命令的命令卡片。
# 参数：$1 为已转义的命令文本。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_command() {
  local command_text="$1"
  local depth
  local indent=''
  depth="$(ui__group_depth)" || return
  printf -v indent '%*s' "$((depth * 2))" ''
  if [[ "$command_text" == '命令已隐藏' ]]; then
    if ui__can_style; then
      ui__render_card warning_border '命令已隐藏'
    else
      printf '%s[命令] 命令已隐藏\n' "$indent" >&2
    fi
    return
  fi
  if ui__can_style; then
    local foreground="$(ui__color muted)" || return
    local border="$(ui__color rail)" || return
    gum style --foreground "$foreground" --border rounded --border-foreground "$border" --padding '0 1' --margin "0 0 0 $((depth * 2))" -- "\$ ${command_text}" >&2
  else
    printf '%s[命令] %s\n' "$indent" "$command_text" >&2
  fi
}

# 渲染捕获或失败的原生命令输出，并更新布局状态。
# 参数：$1 为多行命令输出；空内容不会产生输出。
# 返回：成功时返回 0，否则返回布局或渲染错误码。
ui__render_output() {
  local output="$1"
  [[ -n "$output" ]] || return 0
  ui__layout_before
  ui__render_block rail muted "$output"
  ui__layout_mark
}

# 渲染顶层流程标题卡片或 plain 模式标题。
# 参数：依次为流程域、标题和描述文本。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_flow_start() {
  local domain="$1"
  local title="$2"
  local description="$3"
  if ui__can_style; then
    local eyebrow="$(ui__text accent bold "SCHEMX  /  ${domain}")" || return
    local heading="$(ui__text accent bold "$title")" || return
    ui__render_card flow_border "$(printf '%s\n%s\n%s' "$eyebrow" "$heading" "$description")"
  else
    ui__write_stderr "=== ${title} ==="
    [[ -n "$description" ]] && ui__write_stderr "$description"
  fi
  return 0
}

# 渲染流程内的分组开始标题和可选描述。
# 参数：$1 为分组标题，$2 为描述文本，$3 为分组深度。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_group_start() {
  local title="$1"
  local description="$2"
  local depth="$3"
  local header_depth=$((depth - 1))
  if ui__can_style; then
    local heading="$(ui__text group bold "$title")" || return
    local indent=''
    printf -v indent '%*s' "$((header_depth * 2))" ''
    printf '%s' "$indent" >&2
    gum join -- "$(ui__symbol group group)" '  ' "$heading" >&2
  else
    ui__render_line_at_depth "$header_depth" group group "$title"
  fi
  [[ -n "$description" ]] && ui__render_line_at_depth "$depth" note muted "$description"
  return 0
}

# 渲染带状态和耗时的分组结束行。
# 参数：依次为标题、success/failed/cancelled/skipped、摘要、耗时秒数和分组深度。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_group_finish() {
  local title="$1"
  local status="$2"
  local summary="$3"
  local elapsed="$4"
  local depth="$5"
  local header_depth=$((depth - 1))
  local message="${summary:-$title}（${elapsed}s）"

  case "$status" in
    success) ui__render_line_at_depth "$header_depth" success success "$message" ;;
    failed) ui__render_line_at_depth "$header_depth" error error "$message" ;;
    cancelled) ui__render_line_at_depth "$header_depth" warning warning "$message" ;;
    skipped) ui__render_line_at_depth "$header_depth" warning muted "$message" ;;
    *) return 2 ;;
  esac
}

# 渲染带语义色调的摘要卡片。
# 参数：依次为摘要标题、neutral/success/warning/error 色调和内容。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_summary() {
  local title="$1"
  local tone="$2"
  local content="$3"
  local border="summary_border"
  [[ "$tone" == success ]] && border=success_border
  [[ "$tone" == warning ]] && border=warning_border
  [[ "$tone" == error ]] && border=error_border
  if ui__can_style; then
    local heading="$(ui__text accent bold "$title")" || return
    ui__render_card "$border" "$(printf '%s\n%s' "$heading" "$content")"
  else
    local depth
    depth="$(ui__group_depth)" || return
    ui__render_plain_block "$depth" "$(printf '%s\n%s' "--- ${title} ---" "$content")"
  fi
}

# 渲染任务标题和对应命令。
# 参数：$1 为任务标题，$2 为命令文本。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_task_start() {
  local title="$1"
  local command_text="$2"
  ui__render_line task task "$title"
  ui__render_command "$command_text"
}

# 根据任务结果渲染成功、取消或失败状态行。
# 参数：依次为标题、状态、退出码和耗时秒数。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_task_finish() {
  local title="$1"
  local status="$2"
  local exit_code="$3"
  local elapsed="$4"
  case "$status" in
    success) ui__render_line success success "${title}（${elapsed}s）" ;;
    cancelled) ui__render_line warning warning "${title}已取消（${elapsed}s）" ;;
    *) ui__render_line error error "${title}（退出码 ${exit_code}，${elapsed}s）" ;;
  esac
}

# 渲染未执行任务及其跳过原因。
# 参数：$1 为任务标题，$2 为跳过原因。
# 返回：渲染成功时返回 0，否则返回底层输出错误码。
ui__render_task_skip() {
  ui__render_line warning muted "$1（已跳过：$2）"
}

# 将命令 argv 转换为可展示且具备必要单引号转义的文本。
# 参数：任意数量的命令参数。
# 返回：写入 stdout 的展示命令文本。
ui__command_text() {
  local rendered=''
  local part escaped
  for part in "$@"; do
    if [[ "$part" == *[![:alnum:]_./:=@%+,-]* ]]; then
      escaped="${part//\'/\'\"\'\"\'}"
      rendered+="${rendered:+ }'${escaped}'"
    else
      rendered+="${rendered:+ }${part}"
    fi
  done
  printf '%s' "$rendered"
}
