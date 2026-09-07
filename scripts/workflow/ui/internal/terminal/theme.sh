#!/usr/bin/env bash

# UI 主题与符号注册表；仅供内部渲染函数使用。

set -o pipefail

# 将 UI 颜色令牌解析为 Gum 使用的十六进制颜色值。
# 参数：$1 为 accent、task、success、muted、rail 等已注册令牌。
# 返回：颜色值写入 stdout；未知令牌返回 2。
ui__color() {
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
      ui__write_stderr "未知 UI 颜色令牌：$1"
      return 2
      ;;
  esac
}

# 使用指定颜色和文字样式渲染一段文本。
# 参数：$1 为颜色令牌，$2 为 normal 或 bold，$3 为文本内容。
# 返回：Gum 成功时返回 0，参数或渲染失败时返回非 0。
ui__text() {
  local color="$(ui__color "$1")" || return
  local style="$2"
  local content="$3"
  case "$style" in
    normal) gum style --foreground "$color" -- "$content" ;;
    bold) gum style --foreground "$color" --bold -- "$content" ;;
    *)
      ui__write_stderr "未知 UI 文本样式：${style}"
      return 2
      ;;
  esac
}

# 将语义符号类型渲染为对应 glyph，并应用颜色与粗细样式。
# 参数：$1 为 flow、group、note、task、success、warning、error 或 rail；$2 为颜色令牌。
# 返回：符号写入 stdout；未知类型或渲染失败时返回非 0。
ui__symbol() {
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
      ui__write_stderr "未知 UI 符号类型：${symbol}"
      return 2
      ;;
  esac
  if ui__can_style; then
    ui__text "$color" "$style" "$glyph"
  else
    printf '%s' "$glyph"
  fi
}
