#!/usr/bin/env bash

# UI 主题与符号注册表；仅供内部渲染函数使用。

set -o pipefail

_ui_color() {
  case "$1" in
    accent) printf '#22D3EE' ;;
    group) printf '#0F766E' ;;
    task) printf '#A78BFA' ;;
    success) printf '#059669' ;;
    warning) printf '#D97706' ;;
    error) printf '#E11D48' ;;
    muted) printf '#64748B' ;;
    weak) printf '#94A3B8' ;;
    rail) printf '#CBD5E1' ;;
    flow_border) printf '#6366F1' ;;
    summary_border) printf '#C4B5FD' ;;
    success_border) printf '#86EFAC' ;;
    warning_border) printf '#FCD34D' ;;
    error_border) printf '#FDA4AF' ;;
    *)
      _ui_write_stderr "未知 UI 颜色令牌：$1"
      return 2
      ;;
  esac
}

_ui_text() {
  local color="$(_ui_color "$1")" || return
  local style="$2"
  local content="$3"
  case "$style" in
    normal) gum style --foreground "$color" -- "$content" ;;
    bold) gum style --foreground "$color" --bold -- "$content" ;;
    *)
      _ui_write_stderr "未知 UI 文本样式：${style}"
      return 2
      ;;
  esac
}

_ui_symbol() {
  local symbol="$1"
  local color="$2"
  local glyph
  local style
  case "$symbol" in
    flow) glyph='◆'; style=bold ;;
    group) glyph='◇'; style=bold ;;
    note) glyph='›'; style=normal ;;
    task) glyph='◆'; style=bold ;;
    success) glyph='✓'; style=bold ;;
    warning) glyph='!'; style=bold ;;
    error) glyph='✗'; style=bold ;;
    rail) glyph='│'; style=normal ;;
    *)
      _ui_write_stderr "未知 UI 符号类型：${symbol}"
      return 2
      ;;
  esac
  if _ui_can_style; then
    _ui_text "$color" "$style" "$glyph"
  else
    printf '%s' "$glyph"
  fi
}
