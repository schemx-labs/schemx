#!/usr/bin/env bash

# UI 内部布局原语；业务命令不得直接调用。

set -o pipefail

_ui_render_line() {
  local kind="$1"
  local color="$2"
  local message="$3"
  local marker
  local content

  if _ui_can_style; then
    marker="$(_ui_symbol "$kind" "$color")" || return
    content="$(_ui_text "$color" bold "$message")" || return
    gum join -- "$(gum style --width 2 --align left -- "$marker")" ' ' "$content" >&2
  else
    case "$kind" in
      note) _ui_write_stderr "[说明] ${message}" ;;
      task) _ui_write_stderr "[任务] ${message}" ;;
      success) _ui_write_stderr "[成功] ${message}" ;;
      warning) _ui_write_stderr "[警告] ${message}" ;;
      error) _ui_write_stderr "[错误] ${message}" ;;
      group) _ui_write_stderr "--- ${message} ---" ;;
      *) _ui_write_stderr "$message" ;;
    esac
  fi
}

_ui_render_block() {
  local kind="$1"
  local color="$2"
  local content="$3"
  local line
  while IFS= read -r line || [[ -n "$line" ]]; do
    _ui_render_line "$kind" "$color" "$line" || return
  done <<< "$content"
}

_ui_render_card() {
  local border="$1"
  local content="$2"
  if _ui_can_style; then
    local color="$(_ui_color "$border")" || return
    gum style --border rounded --border-foreground "$color" --padding '1 2' --width 72 -- "$content" >&2
  else
    _ui_write_stderr "$content"
  fi
}

_ui_render_command() {
  local command_text="$1"
  if _ui_can_style; then
    local foreground="$(_ui_color muted)" || return
    local border="$(_ui_color rail)" || return
    gum style --foreground "$foreground" --border rounded --border-foreground "$border" --padding '0 1' -- "\$ ${command_text}" >&2
  else
    _ui_write_stderr "[命令] ${command_text}"
  fi
}

_ui_render_output() {
  local output="$1"
  [[ -n "$output" ]] || return 0
  _ui_layout_before
  _ui_render_block rail muted "$output"
  _ui_layout_mark
}

_ui_render_flow_start() {
  local domain="$1"
  local title="$2"
  local description="$3"
  if _ui_can_style; then
    local eyebrow="$(_ui_text accent bold "SCHEMX  /  ${domain}")" || return
    local heading="$(_ui_text accent bold "$title")" || return
    _ui_render_card flow_border "$(printf '%s\n%s\n%s' "$eyebrow" "$heading" "$description")"
  else
    _ui_write_stderr "=== ${title} ==="
    [[ -n "$description" ]] && _ui_write_stderr "$description"
  fi
  return 0
}

_ui_render_group() {
  local title="$1"
  local description="$2"
  if _ui_can_style; then
    local heading="$(_ui_text group bold "$title")" || return
    gum join -- "$(_ui_symbol group group)" '  ' "$heading" >&2
  else
    _ui_render_line group group "$title"
  fi
  [[ -n "$description" ]] && _ui_render_line note muted "$description"
  return 0
}

_ui_render_summary() {
  local title="$1"
  local tone="$2"
  local content="$3"
  local border="summary_border"
  [[ "$tone" == success ]] && border=success_border
  [[ "$tone" == warning ]] && border=warning_border
  [[ "$tone" == error ]] && border=error_border
  if _ui_can_style; then
    local heading="$(_ui_text accent bold "$title")" || return
    _ui_render_card "$border" "$(printf '%s\n%s' "$heading" "$content")"
  else
    _ui_write_stderr "--- ${title} ---"
    _ui_write_stderr "$content"
  fi
}

_ui_render_task_start() {
  local title="$1"
  local command_text="$2"
  _ui_render_line task task "$title"
  _ui_render_command "$command_text"
}

_ui_render_task_finish() {
  local title="$1"
  local status="$2"
  local exit_code="$3"
  local elapsed="$4"
  case "$status" in
    success) _ui_render_line success success "${title}（${elapsed}s）" ;;
    cancelled) _ui_render_line warning warning "${title}已取消（${elapsed}s）" ;;
    *) _ui_render_line error error "${title}（退出码 ${exit_code}，${elapsed}s）" ;;
  esac
}

_ui_command_text() {
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
